use notify_debouncer_mini::notify::RecursiveMode;
use notify_debouncer_mini::{new_debouncer, DebouncedEventKind};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Mutex;
use std::time::Duration;
use tauri::menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};
use tauri::webview::WebviewWindowBuilder;
use tauri::{AppHandle, Emitter, Manager, WebviewWindow};
use tauri_plugin_log::{Target, TargetKind};

struct WindowState {
    watcher:
        Option<notify_debouncer_mini::Debouncer<notify_debouncer_mini::notify::RecommendedWatcher>>,
    current_file: Option<PathBuf>,
}

#[derive(Clone, serde::Serialize)]
struct PendingFile {
    path: String,
    anchor: Option<String>,
}

struct AppState {
    windows: Mutex<HashMap<String, WindowState>>,
    pending_files: Mutex<HashMap<String, PendingFile>>,
    window_counter: AtomicU32,
}

#[derive(serde::Serialize, Clone)]
struct FileContent {
    content: String,
    dir: String,
    filename: String,
}

fn resolve_path(path: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(path);
    path.canonicalize()
        .or_else(|_| {
            if let Ok(cwd) = std::env::current_dir() {
                cwd.join("..").join(&path).canonicalize()
            } else {
                Err(std::io::Error::new(
                    std::io::ErrorKind::NotFound,
                    "not found",
                ))
            }
        })
        .map_err(|e| format!("Failed to resolve path: {}", e))
}

#[tauri::command]
fn open_file(path: String, window: WebviewWindow) -> Result<FileContent, String> {
    let path = resolve_path(&path)?;

    if !path.exists() {
        return Err(format!("File not found: {}", path.display()));
    }

    let content =
        std::fs::read_to_string(&path).map_err(|e| format!("Failed to read file: {}", e))?;

    let dir = path
        .parent()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();

    let filename = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "Untitled".to_string());

    let _ = window.set_title(&format!("{} — YAMV", filename));

    let app = window.app_handle().clone();
    let label = window.label().to_string();
    start_watching(&app, &label, &path);

    Ok(FileContent {
        content,
        dir,
        filename,
    })
}

#[tauri::command]
fn print_page(window: WebviewWindow) {
    let _ = window.print();
}

#[tauri::command]
fn open_in_editor(path: String, editor: String) -> Result<(), String> {
    let file = PathBuf::from(&path);
    if !file.exists() {
        return Err(format!("File not found: {}", path));
    }

    std::process::Command::new("open")
        .arg("-a")
        .arg(&editor)
        .arg(&path)
        .spawn()
        .map_err(|e| format!("Failed to open editor: {}", e))?;

    Ok(())
}

#[tauri::command]
fn write_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, &content).map_err(|e| format!("Failed to write file: {}", e))
}

#[tauri::command]
fn open_in_new_window(
    path: String,
    anchor: Option<String>,
    app: AppHandle,
) -> Result<(), String> {
    let resolved = resolve_path(&path)?;
    if !resolved.exists() {
        return Err(format!("File not found: {}", resolved.display()));
    }

    let state = app.state::<AppState>();
    let n = state.window_counter.fetch_add(1, Ordering::Relaxed);
    let label = format!("viewer-{}", n);

    state.pending_files.lock().unwrap().insert(
        label.clone(),
        PendingFile {
            path: resolved.to_string_lossy().to_string(),
            anchor,
        },
    );

    let url = tauri::WebviewUrl::App("index.html".into());
    let mut builder = WebviewWindowBuilder::new(&app, &label, url)
        .title("YAMV")
        .inner_size(800.0, 900.0)
        .min_inner_size(400.0, 300.0)
        .resizable(true);

    #[cfg(target_os = "macos")]
    {
        builder = builder
            .title_bar_style(tauri::TitleBarStyle::Overlay)
            .hidden_title(true);
    }

    let window = builder
        .build()
        .map_err(|e| format!("Failed to create window: {}", e))?;

    #[cfg(target_os = "macos")]
    {
        let is_dark = {
            let output = std::process::Command::new("defaults")
                .args(["read", "-g", "AppleInterfaceStyle"])
                .output();
            output.map_or(false, |o| {
                String::from_utf8_lossy(&o.stdout).trim() == "Dark"
            })
        };
        let bg = if is_dark {
            tauri::window::Color(28, 30, 32, 255)
        } else {
            tauri::window::Color(250, 250, 250, 255)
        };
        let _ = window.set_background_color(Some(bg));
    }

    Ok(())
}

#[tauri::command]
fn get_pending_file(window: WebviewWindow, app: AppHandle) -> Option<PendingFile> {
    let label = window.label().to_string();
    let state = app.state::<AppState>();
    let mut pending = state.pending_files.lock().unwrap();
    pending.remove(&label)
}

#[tauri::command]
fn check_cli_installed() -> bool {
    let link = PathBuf::from("/usr/local/bin/yamv");
    link.exists()
}

#[tauri::command]
fn install_cli() -> Result<String, String> {
    let cli_path = "/usr/local/bin/yamv";

    // Resolve the .app bundle path from the current binary
    // Binary is at YAMV.app/Contents/MacOS/YAMV, we need YAMV.app
    let binary = std::env::current_exe().map_err(|e| format!("Failed to find binary: {}", e))?;
    let app_path = binary
        .parent() // MacOS/
        .and_then(|p| p.parent()) // Contents/
        .and_then(|p| p.parent()) // YAMV.app/
        .ok_or_else(|| "Failed to resolve .app bundle path".to_string())?;

    let wrapper = format!(
        "#!/bin/sh\nif [ -n \"$1\" ]; then\n  FILE=\"$(cd \"$(dirname \"$1\")\" 2>/dev/null && pwd)/$(basename \"$1\")\"\n  open \"$FILE\" -a '{}'\nelse\n  open -a '{}'\nfi\n",
        app_path.display(),
        app_path.display()
    );

    // Write wrapper to a temp file first, then use osascript to copy it with
    // admin privileges. This avoids nested quoting issues with echo inside
    // AppleScript's do shell script (the wrapper contains ", $, and ' which
    // break when embedded in echo '...' inside do shell script "...").
    let temp_path = std::env::temp_dir().join("yamv-cli-wrapper");
    std::fs::write(&temp_path, &wrapper)
        .map_err(|e| format!("Failed to write temp file: {}", e))?;

    let script = format!(
        "do shell script \"cp '{}' '{}' && chmod +x '{}'\" with administrator privileges",
        temp_path.display(),
        cli_path,
        cli_path
    );
    let output = std::process::Command::new("osascript")
        .arg("-e")
        .arg(&script)
        .output()
        .map_err(|e| format!("Failed to run osascript: {}", e))?;

    // Clean up temp file regardless of outcome
    let _ = std::fs::remove_file(&temp_path);

    if output.status.success() {
        Ok("CLI installed successfully".to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        if stderr.contains("User canceled") || stderr.contains("-128") {
            Err("Installation cancelled".to_string())
        } else {
            Err(format!("Failed to install CLI: {}", stderr))
        }
    }
}

#[tauri::command]
fn uninstall_cli() -> Result<String, String> {
    let link = "/usr/local/bin/yamv";
    let script = format!(
        "do shell script \"rm -f '{}'\" with administrator privileges",
        link
    );
    let output = std::process::Command::new("osascript")
        .arg("-e")
        .arg(&script)
        .output()
        .map_err(|e| format!("Failed to run osascript: {}", e))?;

    if output.status.success() {
        Ok("CLI uninstalled successfully".to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        if stderr.contains("User canceled") || stderr.contains("-128") {
            Err("Uninstall cancelled".to_string())
        } else {
            Err(format!("Failed to remove symlink: {}", stderr))
        }
    }
}

#[cfg(target_os = "macos")]
mod default_app {
    use core_foundation::base::TCFType;
    use core_foundation::string::CFString;

    const MARKDOWN_UTI: &str = "net.daringfireball.markdown";
    const BUNDLE_ID: &str = "de.martinemmert.projects.yamv";
    const K_LS_ROLES_ALL: u32 = 0xFFFFFFFF;

    extern "C" {
        fn LSSetDefaultRoleHandlerForContentType(
            inContentType: core_foundation::string::CFStringRef,
            inRole: u32,
            inHandlerBundleID: core_foundation::string::CFStringRef,
        ) -> i32;

        fn LSCopyDefaultRoleHandlerForContentType(
            inContentType: core_foundation::string::CFStringRef,
            inRole: u32,
        ) -> core_foundation::string::CFStringRef;
    }

    #[tauri::command]
    pub fn is_default_markdown_app() -> bool {
        let uti = CFString::new(MARKDOWN_UTI);
        unsafe {
            let handler =
                LSCopyDefaultRoleHandlerForContentType(uti.as_concrete_TypeRef(), K_LS_ROLES_ALL);
            if handler.is_null() {
                return false;
            }
            let handler_cf = CFString::wrap_under_create_rule(handler);
            let handler_str = handler_cf.to_string();
            handler_str.eq_ignore_ascii_case(BUNDLE_ID)
        }
    }

    #[tauri::command]
    pub fn set_default_markdown_app() -> Result<(), String> {
        let uti = CFString::new(MARKDOWN_UTI);
        let bundle_id = CFString::new(BUNDLE_ID);
        let result = unsafe {
            LSSetDefaultRoleHandlerForContentType(
                uti.as_concrete_TypeRef(),
                K_LS_ROLES_ALL,
                bundle_id.as_concrete_TypeRef(),
            )
        };
        if result == 0 {
            Ok(())
        } else {
            Err(format!(
                "LSSetDefaultRoleHandlerForContentType returned {}",
                result
            ))
        }
    }
}

#[cfg(not(target_os = "macos"))]
mod default_app {
    #[tauri::command]
    pub fn is_default_markdown_app() -> bool {
        false
    }

    #[tauri::command]
    pub fn set_default_markdown_app() -> Result<(), String> {
        Err("Default app registration is only supported on macOS".to_string())
    }
}

fn start_watching(app: &AppHandle, window_label: &str, path: &PathBuf) {
    let state = app.state::<AppState>();
    let app_handle = app.clone();
    let label = window_label.to_string();
    let watch_path = path.to_path_buf();

    let mut windows = state.windows.lock().unwrap();
    let ws = windows
        .entry(label.clone())
        .or_insert_with(|| WindowState {
            watcher: None,
            current_file: None,
        });
    ws.watcher = None;
    ws.current_file = Some(watch_path.clone());

    let file_path = watch_path.clone();
    let emit_label = label.clone();
    let debouncer = new_debouncer(
        Duration::from_millis(100),
        move |res: Result<
            Vec<notify_debouncer_mini::DebouncedEvent>,
            notify_debouncer_mini::notify::Error,
        >| {
            if let Ok(events) = res {
                let has_change = events.iter().any(|e| e.kind == DebouncedEventKind::Any);
                if has_change {
                    if let Ok(content) = std::fs::read_to_string(&file_path) {
                        let dir = file_path
                            .parent()
                            .map(|p| p.to_string_lossy().to_string())
                            .unwrap_or_default();
                        let filename = file_path
                            .file_name()
                            .map(|n| n.to_string_lossy().to_string())
                            .unwrap_or_default();
                        if let Some(window) = app_handle.get_webview_window(&emit_label) {
                            let _ = window.emit(
                                "file-changed",
                                FileContent {
                                    content,
                                    dir,
                                    filename,
                                },
                            );
                        }
                    }
                }
            }
        },
    );

    match debouncer {
        Ok(mut d) => {
            let _ = d
                .watcher()
                .watch(&watch_path, RecursiveMode::NonRecursive);
            if let Some(ws) = windows.get_mut(&label) {
                ws.watcher = Some(d);
            }
        }
        Err(e) => {
            log::error!("Failed to start file watcher: {}", e);
        }
    }
}

fn build_menu(app: &AppHandle) -> Result<tauri::menu::Menu<tauri::Wry>, tauri::Error> {
    let app_menu = SubmenuBuilder::new(app, "YAMV")
        .item(&PredefinedMenuItem::about(app, Some("About YAMV"), None)?)
        .item(
            &MenuItemBuilder::with_id("check-update", "Check for Updates…").build(app)?,
        )
        .separator()
        .item(
            &MenuItemBuilder::with_id("settings", "Settings…")
                .accelerator("CmdOrCtrl+,")
                .build(app)?,
        )
        .separator()
        .item(&PredefinedMenuItem::hide(app, None)?)
        .item(&PredefinedMenuItem::hide_others(app, None)?)
        .item(&PredefinedMenuItem::show_all(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::quit(app, None)?)
        .build()?;

    let file_menu = SubmenuBuilder::new(app, "File")
        .item(
            &MenuItemBuilder::with_id("open", "Open…")
                .accelerator("CmdOrCtrl+O")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id("toggle-editor", "Edit")
                .accelerator("CmdOrCtrl+E")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id("save", "Save")
                .accelerator("CmdOrCtrl+S")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id("open-in-external", "Open in External Editor…")
                .accelerator("CmdOrCtrl+Shift+E")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id("close-file", "Close File")
                .accelerator("CmdOrCtrl+W")
                .build(app)?,
        )
        .separator()
        .item(
            &MenuItemBuilder::with_id("print", "Print…")
                .accelerator("CmdOrCtrl+P")
                .build(app)?,
        )
        .build()?;

    let edit_menu = SubmenuBuilder::new(app, "Edit")
        .item(&PredefinedMenuItem::undo(app, None)?)
        .item(&PredefinedMenuItem::redo(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::cut(app, None)?)
        .item(&PredefinedMenuItem::copy(app, None)?)
        .item(&PredefinedMenuItem::paste(app, None)?)
        .item(&PredefinedMenuItem::select_all(app, None)?)
        .separator()
        .item(
            &MenuItemBuilder::with_id("find", "Find…")
                .accelerator("CmdOrCtrl+F")
                .build(app)?,
        )
        .build()?;

    let view_menu = SubmenuBuilder::new(app, "View")
        .item(
            &MenuItemBuilder::with_id("toggle-toc", "Toggle Table of Contents")
                .accelerator("CmdOrCtrl+\\")
                .build(app)?,
        )
        .separator()
        .item(
            &MenuItemBuilder::with_id("zoom-in", "Zoom In")
                .accelerator("CmdOrCtrl+=")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id("zoom-out", "Zoom Out")
                .accelerator("CmdOrCtrl+-")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id("zoom-reset", "Actual Size")
                .accelerator("CmdOrCtrl+0")
                .build(app)?,
        )
        .build()?;

    let help_menu = SubmenuBuilder::new(app, "Help")
        .item(
            &MenuItemBuilder::with_id("show-help", "Keyboard Shortcuts")
                .accelerator("CmdOrCtrl+Shift+/")
                .build(app)?,
        )
        .item(&MenuItemBuilder::with_id("show-welcome", "Welcome Guide").build(app)?)
        .item(
            &MenuItemBuilder::with_id("show-test-doc", "Rendering Test Document").build(app)?,
        )
        .separator()
        .item(
            &MenuItemBuilder::with_id("show-ql-troubleshooting", "QuickLook Troubleshooting")
                .build(app)?,
        )
        .build()?;

    MenuBuilder::new(app)
        .item(&app_menu)
        .item(&file_menu)
        .item(&edit_menu)
        .item(&view_menu)
        .item(&help_menu)
        .build()
}

fn emit_to_focused_window(app: &AppHandle, event: &str, payload: &str) {
    for (_, window) in app.webview_windows() {
        if window.is_focused().unwrap_or(false) {
            let _ = window.emit(event, payload);
            return;
        }
    }
    // Fallback: if no window reports focused, emit to all
    let _ = app.emit(event, payload);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .targets([
                    Target::new(TargetKind::Stdout),
                    Target::new(TargetKind::LogDir { file_name: None }),
                    Target::new(TargetKind::Webview),
                ])
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_cli::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_os::init())
        .manage(AppState {
            windows: Mutex::new(HashMap::new()),
            pending_files: Mutex::new(HashMap::new()),
            window_counter: AtomicU32::new(0),
        })
        .invoke_handler(tauri::generate_handler![
            open_file,
            print_page,
            open_in_editor,
            write_file,
            open_in_new_window,
            get_pending_file,
            check_cli_installed,
            install_cli,
            uninstall_cli,
            default_app::is_default_markdown_app,
            default_app::set_default_markdown_app
        ])
        .setup(|app| {
            let handle = app.handle().clone();
            if let Some(window) = app.get_webview_window("main") {
                // Set window background to match theme — prevents white flash on startup
                #[cfg(target_os = "macos")]
                {
                    let is_dark = {
                        let output = std::process::Command::new("defaults")
                            .args(["read", "-g", "AppleInterfaceStyle"])
                            .output();
                        output.map_or(false, |o| {
                            String::from_utf8_lossy(&o.stdout).trim() == "Dark"
                        })
                    };
                    let bg = if is_dark {
                        tauri::window::Color(28, 30, 32, 255) // #1c1e20
                    } else {
                        tauri::window::Color(250, 250, 250, 255) // #fafafa
                    };
                    let _ = window.set_background_color(Some(bg));
                }

                if let Ok(Some(monitor)) = window.current_monitor() {
                    let size = monitor.size();
                    let scale = monitor.scale_factor();
                    let w = size.width as f64 / scale * 0.4;
                    let h = size.height as f64 / scale * 0.8;
                    let _ =
                        window.set_size(tauri::Size::Logical(tauri::LogicalSize::new(w, h)));
                    let _ = window.center();
                }
            }

            let menu = build_menu(&handle)?;
            app.set_menu(menu)?;

            Ok(())
        })
        .on_menu_event(|app, event| {
            let id = event.id().as_ref();
            if id == "print" {
                for (_, window) in app.webview_windows() {
                    if window.is_focused().unwrap_or(false) {
                        let _ = window.print();
                        return;
                    }
                }
                return;
            }
            emit_to_focused_window(app, "menu-action", id);
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

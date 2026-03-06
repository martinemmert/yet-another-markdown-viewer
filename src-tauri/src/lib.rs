use notify_debouncer_mini::notify::RecursiveMode;
use notify_debouncer_mini::{new_debouncer, DebouncedEventKind};
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::Duration;
use tauri::menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};
use tauri::{AppHandle, Emitter, Manager};

struct AppState {
    watcher: Mutex<Option<notify_debouncer_mini::Debouncer<notify_debouncer_mini::notify::RecommendedWatcher>>>,
    current_file: Mutex<Option<PathBuf>>,
}

#[derive(serde::Serialize, Clone)]
struct FileContent {
    content: String,
    dir: String,
    filename: String,
}

#[tauri::command]
fn open_file(path: String, app: AppHandle) -> Result<FileContent, String> {
    let path = PathBuf::from(&path);
    let path = path
        .canonicalize()
        .map_err(|e| format!("Failed to resolve path: {}", e))?;

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

    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_title(&format!("{} — YAMV", filename));
    }

    start_watching(&app, &path);

    Ok(FileContent {
        content,
        dir,
        filename,
    })
}

#[tauri::command]
fn print_page(app: AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.print();
    }
}

#[tauri::command]
fn get_initial_file() -> Option<String> {
    let args: Vec<String> = std::env::args().collect();
    if args.len() > 1 {
        let path = PathBuf::from(&args[1]);
        if let Ok(abs) = path.canonicalize() {
            return Some(abs.to_string_lossy().to_string());
        }
        if let Ok(cwd) = std::env::current_dir() {
            let from_parent = cwd.join("..").join(&args[1]);
            if let Ok(abs) = from_parent.canonicalize() {
                return Some(abs.to_string_lossy().to_string());
            }
        }
        Some(args[1].clone())
    } else {
        None
    }
}

fn start_watching(app: &AppHandle, path: &PathBuf) {
    let state = app.state::<AppState>();
    let app_handle = app.clone();
    let watch_path = path.to_path_buf();

    let mut watcher_guard = state.watcher.lock().unwrap();
    *watcher_guard = None;

    let mut file_guard = state.current_file.lock().unwrap();
    *file_guard = Some(watch_path.clone());
    drop(file_guard);

    let file_path = watch_path.clone();
    let debouncer = new_debouncer(
        Duration::from_millis(100),
        move |res: Result<Vec<notify_debouncer_mini::DebouncedEvent>, notify_debouncer_mini::notify::Error>| {
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
                        let _ = app_handle.emit(
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
        },
    );

    match debouncer {
        Ok(mut d) => {
            let _ = d
                .watcher()
                .watch(&watch_path, RecursiveMode::NonRecursive);
            *watcher_guard = Some(d);
        }
        Err(e) => {
            eprintln!("Failed to start file watcher: {}", e);
        }
    }
}

fn build_menu(app: &AppHandle) -> Result<tauri::menu::Menu<tauri::Wry>, tauri::Error> {
    let app_menu = SubmenuBuilder::new(app, "YAMV")
        .item(&PredefinedMenuItem::about(app, Some("About YAMV"), None)?)
        .separator()
        .item(&MenuItemBuilder::with_id("settings", "Settings…").accelerator("CmdOrCtrl+,").build(app)?)
        .separator()
        .item(&PredefinedMenuItem::hide(app, None)?)
        .item(&PredefinedMenuItem::hide_others(app, None)?)
        .item(&PredefinedMenuItem::show_all(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::quit(app, None)?)
        .build()?;

    let file_menu = SubmenuBuilder::new(app, "File")
        .item(&MenuItemBuilder::with_id("open", "Open…").accelerator("CmdOrCtrl+O").build(app)?)
        .item(&MenuItemBuilder::with_id("close-file", "Close File").accelerator("CmdOrCtrl+W").build(app)?)
        .separator()
        .item(&MenuItemBuilder::with_id("print", "Print…").accelerator("CmdOrCtrl+P").build(app)?)
        .build()?;

    let edit_menu = SubmenuBuilder::new(app, "Edit")
        .item(&PredefinedMenuItem::copy(app, None)?)
        .item(&PredefinedMenuItem::select_all(app, None)?)
        .separator()
        .item(&MenuItemBuilder::with_id("find", "Find…").accelerator("CmdOrCtrl+F").build(app)?)
        .build()?;

    let view_menu = SubmenuBuilder::new(app, "View")
        .item(&MenuItemBuilder::with_id("toggle-toc", "Toggle Table of Contents").accelerator("CmdOrCtrl+\\").build(app)?)
        .separator()
        .item(&MenuItemBuilder::with_id("zoom-in", "Zoom In").accelerator("CmdOrCtrl+=").build(app)?)
        .item(&MenuItemBuilder::with_id("zoom-out", "Zoom Out").accelerator("CmdOrCtrl+-").build(app)?)
        .item(&MenuItemBuilder::with_id("zoom-reset", "Actual Size").accelerator("CmdOrCtrl+0").build(app)?)
        .build()?;

    let help_menu = SubmenuBuilder::new(app, "Help")
        .item(&MenuItemBuilder::with_id("show-help", "Keyboard Shortcuts").accelerator("CmdOrCtrl+Shift+/").build(app)?)
        .build()?;

    MenuBuilder::new(app)
        .item(&app_menu)
        .item(&file_menu)
        .item(&edit_menu)
        .item(&view_menu)
        .item(&help_menu)
        .build()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .manage(AppState {
            watcher: Mutex::new(None),
            current_file: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![open_file, get_initial_file, print_page])
        .setup(|app| {
            let handle = app.handle().clone();
            if let Some(window) = app.get_webview_window("main") {
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
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.print();
                }
                return;
            }
            let _ = app.emit("menu-action", id);
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

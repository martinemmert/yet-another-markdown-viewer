use notify_debouncer_mini::notify::RecursiveMode;
use notify_debouncer_mini::{new_debouncer, DebouncedEventKind};
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::Duration;
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
fn get_initial_file() -> Option<String> {
    let args: Vec<String> = std::env::args().collect();
    if args.len() > 1 {
        let path = PathBuf::from(&args[1]);
        // Try resolving as-is first
        if let Ok(abs) = path.canonicalize() {
            return Some(abs.to_string_lossy().to_string());
        }
        // In tauri dev, CWD is src-tauri/ — try resolving from parent (project root)
        if let Ok(cwd) = std::env::current_dir() {
            let from_parent = cwd.join("..").join(&args[1]);
            if let Ok(abs) = from_parent.canonicalize() {
                return Some(abs.to_string_lossy().to_string());
            }
        }
        // Return as-is as fallback
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .manage(AppState {
            watcher: Mutex::new(None),
            current_file: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![open_file, get_initial_file])
        .setup(|app| {
            // Set initial window size to 40% width x 80% height of monitor
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
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

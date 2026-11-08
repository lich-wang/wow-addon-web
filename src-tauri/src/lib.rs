mod bridge;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Start embedded local bridge server on 127.0.0.1:24642
    bridge::start_bridge_server();

    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}

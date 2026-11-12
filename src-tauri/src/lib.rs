mod bridge;

use serde_json::{json, Value};
use std::{fs, io::Cursor, path::PathBuf};

#[tauri::command]
fn ping() -> Result<Value, String> {
    let installs = bridge::find_wow_installations();
    Ok(json!({
        "status": "ok",
        "version": "1.0.7",
        "platform": std::env::consts::OS,
        "installations": installs
    }))
}

#[tauri::command]
async fn pick_folder() -> Result<Value, String> {
    let res = tokio::task::spawn_blocking(|| {
        rfd::FileDialog::new()
            .set_title("请选择魔兽世界 AddOns 目录 (或版本根目录)")
            .pick_folder()
    })
    .await;

    match res {
        Ok(Some(folder)) => {
            let path_str = folder.to_string_lossy().to_string();
            let target_path = if folder.join("Interface").join("AddOns").is_dir() {
                folder.join("Interface").join("AddOns").to_string_lossy().to_string()
            } else {
                path_str
            };
            Ok(json!({ "success": true, "path": target_path }))
        }
        _ => Ok(json!({ "success": false, "cancelled": true })),
    }
}

#[tauri::command]
fn scan_addons(path: String) -> Result<Value, String> {
    let p = PathBuf::from(&path);
    if !p.is_dir() {
        return Err("指定目录不存在或无法访问".to_string());
    }
    let addons = bridge::scan_addons_dir(&p);
    Ok(json!({
        "path": path,
        "addons": addons
    }))
}

#[tauri::command]
fn delete_addon(addons_path: String, folder_name: String) -> Result<Value, String> {
    if folder_name.contains("..") || folder_name.contains('/') || folder_name.contains('\\') {
        return Err("非法的插件目录名称".to_string());
    }
    let base = PathBuf::from(&addons_path);
    let target = base.join(&folder_name);
    if !target.is_dir() {
        return Err("插件目录不存在".to_string());
    }
    fs::remove_dir_all(&target).map_err(|e| format!("删除失败: {}", e))?;
    Ok(json!({ "success": true }))
}

#[tauri::command]
fn install_zip(addons_path: String, zip_bytes: Vec<u8>) -> Result<Value, String> {
    let target_dir = PathBuf::from(&addons_path);
    if !target_dir.is_dir() {
        return Err("目标目录不存在".to_string());
    }
    let cursor = Cursor::new(zip_bytes);
    let mut zip = zip::ZipArchive::new(cursor).map_err(|e| format!("无效的 ZIP 压缩包: {}", e))?;
    for i in 0..zip.len() {
        let file = zip.by_index(i).map_err(|e| format!("读取压缩包条目失败: {}", e))?;
        if file.enclosed_name().is_none() {
            return Err("压缩包包含不安全的文件路径 (Zip Slip)".to_string());
        }
    }
    let file_count = zip.len();
    zip.extract(&target_dir).map_err(|e| format!("解压失败: {}", e))?;
    Ok(json!({ "success": true, "fileCount": file_count }))
}

#[tauri::command]
fn open_folder(path: String) -> Result<Value, String> {
    let _ = open::that(&path);
    Ok(json!({ "success": true }))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Start embedded local bridge server on 127.0.0.1:24642 for web browsers
    bridge::start_bridge_server();

    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            ping,
            pick_folder,
            scan_addons,
            delete_addon,
            install_zip,
            open_folder,
        ])
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}

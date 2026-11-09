use axum::{
    body::Bytes,
    extract::{DefaultBodyLimit, Query},
    http::{header::HeaderName, HeaderValue, StatusCode},
    response::{IntoResponse, Json},
    routing::{get, post},
    Router,
};
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    fs::{self, File},
    io::{BufRead, BufReader, Cursor},
    path::{Path, PathBuf},
};
use sysinfo::System;
use tower_http::cors::{Any, CorsLayer};

const PORT: u16 = 24642;

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct WowInstallation {
    pub name: String,
    pub flavor: String,
    pub addons_path: String,
    pub game_root: String,
    pub is_running: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AddonInfo {
    pub id: String,
    pub name: String,
    pub raw_title: String,
    pub version: String,
    pub author: String,
    pub notes: String,
    pub interface_version: String,
    pub curse_id: Option<String>,
    pub wago_id: Option<String>,
    pub folder_name: String,
    pub dependencies: Vec<String>,
    pub file_count: usize,
    pub total_size: u64,
    pub modified_time: u64,
    pub status: String,
}

#[derive(Deserialize)]
struct AddonsQuery {
    path: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct DeleteRequest {
    addons_path: String,
    folder_name: String,
}

#[derive(Deserialize)]
struct OpenFolderRequest {
    path: String,
}

fn clean_wow_string(s: &str) -> String {
    let re_color_block = Regex::new(r"\|c[0-9a-fA-F]{8}(.*?)\|r").unwrap();
    let re_color_tag = Regex::new(r"\|c[0-9a-fA-F]{8}").unwrap();
    let re_texture = Regex::new(r"(?i)\|T.*?\|t").unwrap();

    let step1 = re_color_block.replace_all(s, "$1");
    let step2 = re_color_tag.replace_all(&step1, "");
    let step3 = step2.replace("|r", "");
    let step4 = re_texture.replace_all(&step3, "");
    step4.trim().to_string()
}

fn check_running_wow_exes() -> Vec<String> {
    let mut sys = System::new();
    sys.refresh_processes();
    let mut list = Vec::new();

    for (_pid, p) in sys.processes() {
        let name_str = p.name().to_lowercase();
        if (name_str.starts_with("wow") || name_str.contains("warcraft"))
            && !name_str.contains("agent")
            && !name_str.contains("helper")
        {
            if let Some(exe) = p.exe() {
                list.push(exe.to_string_lossy().to_string());
            } else {
                list.push(name_str);
            }
        }
    }

    list
}

pub fn find_wow_installations() -> Vec<WowInstallation> {
    let mut candidates = Vec::new();

    #[cfg(target_os = "windows")]
    {
        candidates.push(r"C:\Program Files (x86)\World of Warcraft".to_string());
        candidates.push(r"C:\Program Files\World of Warcraft".to_string());
        candidates.push(r"C:\World of Warcraft".to_string());
        candidates.push(r"D:\World of Warcraft".to_string());
        candidates.push(r"E:\World of Warcraft".to_string());
        candidates.push(r"D:\Games\World of Warcraft".to_string());
        candidates.push(r"E:\Games\World of Warcraft".to_string());
        candidates.push(r"F:\World of Warcraft".to_string());
    }

    #[cfg(target_os = "macos")]
    {
        candidates.push("/Applications/World of Warcraft".to_string());
        if let Ok(home) = std::env::var("HOME") {
            candidates.push(format!("{}/Applications/World of Warcraft", home));
        }
    }

    #[cfg(target_os = "linux")]
    {
        if let Ok(home) = std::env::var("HOME") {
            candidates.push(format!("{}/.wine/drive_c/Program Files (x86)/World of Warcraft", home));
            candidates.push(format!("{}/Games/world-of-warcraft/drive_c/Program Files (x86)/World of Warcraft", home));
        }
    }

    let flavors = [
        ("_forever_", "无限服 (WoW Forever)"),
        ("_retail_", "正式服 (The War Within)"),
        ("_classic_", "经典怀旧服 (Classic)"),
        ("_classic_era_", "经典旧世 (Era)"),
        ("_classic_titan_", "怀旧泰坦 (Titan)"),
        ("_ptr_", "测试服 (PTR)"),
    ];

    let running_exes = check_running_wow_exes();

    let mut found = Vec::new();
    for root_str in candidates {
        let root = Path::new(&root_str);
        if !root.is_dir() {
            continue;
        }

        for (flavor_dir, label) in flavors {
            let addons_path = root.join(flavor_dir).join("Interface").join("AddOns");
            if addons_path.is_dir() {
                let flavor_name = flavor_dir.trim_matches('_').to_string();
                let lower_flavor = flavor_dir.to_lowercase();

                let is_running = running_exes.iter().any(|exe| {
                    let lower_exe = exe.to_lowercase();
                    lower_exe.contains(&lower_flavor)
                });

                found.push(WowInstallation {
                    name: format!("{} ({})", label, flavor_name),
                    flavor: flavor_name,
                    addons_path: addons_path.to_string_lossy().to_string(),
                    game_root: root.to_string_lossy().to_string(),
                    is_running,
                });
            }
        }
    }

    found.sort_by(|a, b| {
        let a_run = if a.is_running { 1 } else { 0 };
        let b_run = if b.is_running { 1 } else { 0 };
        if a_run != b_run {
            return b_run.cmp(&a_run);
        }
        let a_fav = if a.flavor == "forever" { 1 } else { 0 };
        let b_fav = if b.flavor == "forever" { 1 } else { 0 };
        b_fav.cmp(&a_fav)
    });

    found
}

fn parse_toc_file(path: &Path, folder_name: &str) -> AddonInfo {
    let mut meta = HashMap::new();

    if let Ok(file) = File::open(path) {
        let reader = BufReader::new(file);
        for line in reader.lines().flatten() {
            let trimmed = line.trim();
            if trimmed.starts_with("##") {
                if let Some((k, v)) = trimmed[2..].split_once(':') {
                    meta.insert(k.trim().to_lowercase(), v.trim().to_string());
                }
            }
        }
    }

    let raw_title = meta
        .get("title-zhcn")
        .or_else(|| meta.get("title"))
        .cloned()
        .unwrap_or_else(|| folder_name.to_string());

    let raw_notes = meta
        .get("notes-zhcn")
        .or_else(|| meta.get("notes"))
        .cloned()
        .unwrap_or_default();

    let cleaned_title = clean_wow_string(&raw_title);
    let name = if cleaned_title.is_empty() {
        folder_name.to_string()
    } else {
        cleaned_title
    };

    let deps = meta
        .get("dependencies")
        .or_else(|| meta.get("requireddeps"))
        .map(|d| {
            d.split(',')
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect()
        })
        .unwrap_or_default();

    AddonInfo {
        id: folder_name.to_string(),
        name,
        raw_title,
        version: meta.get("version").cloned().unwrap_or_else(|| "未知版本".to_string()),
        author: meta.get("author").cloned().unwrap_or_else(|| "未知作者".to_string()),
        notes: clean_wow_string(&raw_notes),
        interface_version: meta.get("interface").cloned().unwrap_or_default(),
        curse_id: meta.get("x-curse-project-id").cloned(),
        wago_id: meta.get("x-wago-id").cloned(),
        folder_name: folder_name.to_string(),
        dependencies: deps,
        file_count: 0,
        total_size: 0,
        modified_time: 0,
        status: "local-only".to_string(),
    }
}

pub fn scan_addons_dir(addons_path: &Path) -> Vec<AddonInfo> {
    let mut addons = Vec::new();
    let entries = match fs::read_dir(addons_path) {
        Ok(e) => e,
        Err(_) => return addons,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        let folder_name = match path.file_name().and_then(|n| n.to_str()) {
            Some(name) => name.to_string(),
            None => continue,
        };

        let exact_toc = path.join(format!("{}.toc", folder_name));
        let mut chosen_toc = if exact_toc.is_file() {
            Some(exact_toc)
        } else {
            None
        };

        if chosen_toc.is_none() {
            if let Ok(sub) = fs::read_dir(&path) {
                for f in sub.flatten() {
                    let fp = f.path();
                    if fp.is_file() {
                        if let Some(ext) = fp.extension() {
                            if ext.eq_ignore_ascii_case("toc") {
                                chosen_toc = Some(fp);
                                break;
                            }
                        }
                    }
                }
            }
        }

        let mut file_count = 0;
        let mut total_size = 0;
        let mut latest_mtime = 0;

        for w in walkdir::WalkDir::new(&path).into_iter().flatten() {
            if w.file_type().is_file() {
                file_count += 1;
                if let Ok(m) = w.metadata() {
                    total_size += m.len();
                    if let Ok(time) = m.modified() {
                        if let Ok(dur) = time.duration_since(std::time::UNIX_EPOCH) {
                            let ms = dur.as_millis() as u64;
                            if ms > latest_mtime {
                                latest_mtime = ms;
                            }
                        }
                    }
                }
            }
        }

        let mut info = if let Some(toc_file) = chosen_toc {
            parse_toc_file(&toc_file, &folder_name)
        } else {
            AddonInfo {
                id: folder_name.clone(),
                name: folder_name.clone(),
                raw_title: folder_name.clone(),
                version: "未知".to_string(),
                author: "未知".to_string(),
                notes: "未找到标准 .toc 文件".to_string(),
                interface_version: "".to_string(),
                curse_id: None,
                wago_id: None,
                folder_name: folder_name.clone(),
                dependencies: Vec::new(),
                file_count: 0,
                total_size: 0,
                modified_time: 0,
                status: "local-only".to_string(),
            }
        };

        info.file_count = file_count;
        info.total_size = total_size;
        info.modified_time = latest_mtime;
        addons.push(info);
    }

    addons.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    addons
}

pub fn start_bridge_server() {
    std::thread::spawn(|| {
        let rt = match tokio::runtime::Builder::new_multi_thread()
            .worker_threads(2)
            .enable_all()
            .build()
        {
            Ok(rt) => rt,
            Err(e) => {
                eprintln!("[Bridge] Failed to build Tokio runtime: {}", e);
                return;
            }
        };

        rt.block_on(async {
            let app = Router::new()
                .route(
                    "/api/ping",
                    get(|| async move {
                        let dynamic_installs = find_wow_installations();
                        Json(serde_json::json!({
                            "status": "ok",
                            "version": "1.0.0",
                            "mode": "tauri-embedded",
                            "platform": std::env::consts::OS,
                            "installations": dynamic_installs
                        }))
                    }),
                )
                .route(
                    "/api/pick-folder",
                    post(|| async {
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

                                Json(serde_json::json!({
                                    "success": true,
                                    "path": target_path
                                }))
                            }
                            _ => Json(serde_json::json!({
                                "success": false,
                                "cancelled": true
                            })),
                        }
                    }),
                )
                .route(
                    "/api/addons",
                    get(|Query(q): Query<AddonsQuery>| async move {
                        let path_str = match q.path {
                            Some(p) if !p.trim().is_empty() => p,
                            _ => {
                                return (
                                    StatusCode::BAD_REQUEST,
                                    Json(serde_json::json!({ "error": "缺少 path 参数" })),
                                )
                                    .into_response()
                            }
                        };

                        let path = PathBuf::from(&path_str);
                        if !path.is_dir() {
                            return (
                                StatusCode::BAD_REQUEST,
                                Json(serde_json::json!({ "error": "指定目录不存在或无法访问" })),
                            )
                                .into_response();
                        }

                        let addons = scan_addons_dir(&path);
                        Json(serde_json::json!({
                            "path": path_str,
                            "addons": addons
                        }))
                        .into_response()
                    }),
                )
                .route(
                    "/api/delete",
                    post(|Json(req): Json<DeleteRequest>| async move {
                        let base = PathBuf::from(&req.addons_path);
                        let target = base.join(&req.folder_name);

                        if !target.is_dir() {
                            return (
                                StatusCode::NOT_FOUND,
                                Json(serde_json::json!({ "error": "插件目录不存在" })),
                            );
                        }

                        match fs::remove_dir_all(&target) {
                            Ok(_) => (StatusCode::OK, Json(serde_json::json!({ "success": true }))),
                            Err(e) => (
                                StatusCode::INTERNAL_SERVER_ERROR,
                                Json(serde_json::json!({ "error": format!("删除失败: {}", e) })),
                            ),
                        }
                    }),
                )
                .route(
                    "/api/install-zip",
                    post(|headers: axum::http::HeaderMap, body: Bytes| async move {
                        let target_path_str = match headers.get("x-addons-path") {
                            Some(val) => match val.to_str() {
                                Ok(s) => s.to_string(),
                                Err(_) => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "error": "Invalid target path header" }))),
                            },
                            None => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "error": "Missing x-addons-path header" }))),
                        };

                        let target_dir = PathBuf::from(&target_path_str);
                        if !target_dir.is_dir() {
                            return (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "error": "Target directory does not exist" })));
                        }

                        let cursor = Cursor::new(body);
                        let mut zip = match zip::ZipArchive::new(cursor) {
                            Ok(z) => z,
                            Err(e) => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "error": format!("Invalid ZIP archive: {}", e) }))),
                        };

                        let file_count = zip.len();
                        if let Err(e) = zip.extract(&target_dir) {
                            return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": format!("Extract error: {}", e) })));
                        }

                        (StatusCode::OK, Json(serde_json::json!({ "success": true, "fileCount": file_count })))
                    }),
                )
                .route(
                    "/api/open-folder",
                    post(|Json(req): Json<OpenFolderRequest>| async move {
                        let _ = open::that(&req.path);
                        Json(serde_json::json!({ "success": true }))
                    }),
                )
                .layer(
                    tower::ServiceBuilder::new()
                        .layer(DefaultBodyLimit::max(200 * 1024 * 1024))
                        .layer(
                            CorsLayer::new()
                                .allow_origin(Any)
                                .allow_methods(Any)
                                .allow_headers(Any),
                        )
                        .layer(tower_http::set_header::SetResponseHeaderLayer::overriding(
                            HeaderName::from_static("access-control-allow-private-network"),
                            HeaderValue::from_static("true"),
                        )),
                );

            match tokio::net::TcpListener::bind(format!("127.0.0.1:{}", PORT)).await {
                Ok(listener) => {
                    println!("[Bridge] Embedded bridge listening on 127.0.0.1:{}", PORT);
                    if let Err(e) = axum::serve(listener, app).await {
                        eprintln!("[Bridge] Axum server error: {}", e);
                    }
                }
                Err(e) => {
                    println!("[Bridge] Port {} unavailable or in use ({}). Reusing existing instance.", PORT, e);
                }
            }
        });
    });
}

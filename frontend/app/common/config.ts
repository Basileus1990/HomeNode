import log from "loglevel";


const CONFIG_ENDPOINT = import.meta.env.VITE_CONFIG_ENDPOINT as string;

type HomeNodeFrontendConfig = {
    streamer_inactivity_timeout: number;
    streamer_cleanup_interval: number;

    batch_size: number;
    use_little_endian: boolean;

    host_connect_ws_url: string;
    host_reconnect_ws_url_template: string;
    client_metadata_ws_url_template: string;
    client_download_ws_url_template: string;
    client_create_file_ws_url_template: string;
    client_create_dir_ws_url_template: string;
    client_delete_resource_ws_url_template: string;

    pbkf2_iterations: number;
    aes_key_length: number;
    salt_bytes: number;
    aes_iv_bytes: number;
}

const defautConfig: HomeNodeFrontendConfig = {
    streamer_inactivity_timeout: 30000,
    streamer_cleanup_interval: 10000,

    //chunkSize: 32*1024,
    batch_size: 34768,
    use_little_endian: false,

    host_connect_ws_url: "ws://localhost:3000/api/vi1/host/connect",
    host_reconnect_ws_url_template: "ws://localhost:3000/api/v1/host/reconnect/@hostId?hostKey=@hostKey",
    client_metadata_ws_url_template: "ws://localhost:3000/api/v1/host/@hostId/@itemId/metadata",
    client_download_ws_url_template: "ws://localhost:3000/api/v1/host/@hostId/@itemId/download",
    client_create_file_ws_url_template: "ws://localhost:3000/api/v1/host/file/create/@hostId/@path?uploadFileSize=@fileSize",
    client_create_dir_ws_url_template: "ws://localhost:3000/api/v1/host/directory/create/@hostId/@path",
    client_delete_resource_ws_url_template: "ws://localhost:3000/api/v1/host/delete/@hostId/@path",

    pbkf2_iterations: 10000,
    aes_key_length: 256,
    salt_bytes: 16,
    aes_iv_bytes: 12,
}

let _config: HomeNodeFrontendConfig | undefined = undefined;

async function loadConfig() {
    try {
        console.log(CONFIG_ENDPOINT);
        const response = await fetch(CONFIG_ENDPOINT);
        const config = await response.json();
        _config = config;
    } catch (e) {
        _config = defautConfig;
        console.warn(`Could not get config from server: ${e}. Using default`);
    }
}

async function getConfig() {
    if (!_config)
        await loadConfig();
    return _config as HomeNodeFrontendConfig;
}

export {
    getConfig,
    loadConfig,
    type HomeNodeFrontendConfig
}
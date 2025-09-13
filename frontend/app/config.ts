const CONFIG_ENDPOINT = import.meta.env.VITE_CONFIG_ENDPOINT as string;

type HomeNodeFrontendConfig = {
    streamer_inactivity_timeout: number;
    streamer_cleanup_interval: number;

    //chunkSize: number;
    use_little_endian: boolean;

    server_ws_url: string;
    record_info_ws_url: string;
    record_download_ws_url: string;

    pbkf2_iterations: number;
    aes_key_length: number;
    salt_bytes: number;
    aes_iv_bytes: number;
}

const defautConfig: HomeNodeFrontendConfig = {
    streamer_inactivity_timeout: 30000,
    streamer_cleanup_interval: 10000,

    //chunkSize: 32*1024,
    use_little_endian: false,

    server_ws_url: "ws://localhost:3000/api/vi1/host/connect",
    record_info_ws_url: "ws://localhost:3000/api/v1/host/@hostId/@itemId/metadata",
    record_download_ws_url: "ws://localhost:3000/api/v1/host/@hostId/@itemId/download",

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
        console.log('loaded config from server', config);
    } catch (e) {
        //_config = defautConfig;
        console.log('eror when fetching config, using defauklt', e);
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
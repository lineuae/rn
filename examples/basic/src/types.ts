export type StreamConfig = {
    width: number;
    height: number;
    fps: number;
    bitrateKbps: number;
    maxBitrateKbps: number;
    hardware_acceleration: boolean;
    videoCodec: string;
};

export type AppConfig = {
    token: string;
    acceptedAuthors: string[];
    mongo_uri?: string;
    streamOpts: StreamConfig;
};

export type AutoVocState = {
    guildId: string;
    channelId: string;
    enabled: boolean;
    timestamp: number;
};

export type Args = {
    url: string;
};

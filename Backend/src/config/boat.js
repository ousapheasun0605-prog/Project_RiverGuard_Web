// Settings for the link between this backend and the boat.
// "firmware" = the real RiverGuard ESP32-S3 firmware (riverguard_boat_esp32):
//   boat -> <prefix>/telemetry  JSON {"mode","lat","lon","hdg","spd","batP","v",...}
//   web  -> <prefix>/cmd        plain text: stop | drive <l> <r> | home | target <lat> <lon> | go | rth | calh | cals | speed <n> | wait <min>
// "json" = the older robot/1/* JSON protocol with command acknowledgements.
export const BOAT_PROTOCOL = (process.env.BOAT_PROTOCOL || "firmware").toLowerCase();
export const BOAT_TOPIC_PREFIX = process.env.BOAT_TOPIC_PREFIX || "riverguard-itc";
export const BOAT_TELEMETRY_TOPIC = `${BOAT_TOPIC_PREFIX}/telemetry`;
export const BOAT_COMMAND_TOPIC = `${BOAT_TOPIC_PREFIX}/cmd`;

// The boat counts as online while telemetry keeps arriving (firmware sends every 5 s).
export const BOAT_ONLINE_TIMEOUT_MS = Number(process.env.MQTT_HEARTBEAT_TIMEOUT_MS || 20000);

// Firmware MAX_PCT caps throttle anyway; this caps what the website may ask for.
export const DRIVE_LIMIT = 100;

export const isFirmwareProtocol = () => BOAT_PROTOCOL === "firmware";

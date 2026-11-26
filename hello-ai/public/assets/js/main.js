import { createApp } from "./app.js";
import { readConfig } from "./config.js";

createApp({ config: readConfig() });

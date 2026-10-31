import { httpServerHandler } from "cloudflare:node";
import { createApp } from "./app.js";

const PORT = 8080;

createApp().listen(PORT);

const http = httpServerHandler({ port: PORT });

export default http;

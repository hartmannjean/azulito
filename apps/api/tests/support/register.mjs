// Registra o hook de módulos usado pelos testes (ver loader.mjs).
import { register } from "node:module";

register("./loader.mjs", import.meta.url);

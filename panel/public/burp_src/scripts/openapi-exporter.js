// ============================================================
// Hyper RB · Scripts · #22 openapi-exporter
// Exporta OpenAPI 3.1 standalone — foca na qualidade do schema
// com requestBody/response bodies inferidos via JSON Schema.
// Complementa cartographer (que foca no mapa navegável).
// Sem IA, sem rede. Wave 1 · Agent C.
// FIX/IMPROVE (Wave 1 · Agent G):
//   - operationId gerado (camelCase de method+path)
//   - query parameters extraídos dos requests capturados
//   - BUG: mimeType único por operação → agora por status-code
//   - components/schemas com $ref para schemas de response
//   - example inline nos schemas de request/response
// ============================================================
(function registerScript() {
  "use strict";
  const S = window.HYPER_RB_SHARED;
  if (!S) { console.error("[Hyper RB · openapi-exporter] HYPER_RB_SHARED ausente"); return; }

  const MAX_ENUM = 6;
  const MAX_SAMPLES = 30;

  function tryJson(s) {
    if (typeof s !== "string") return undefined;
    const t = s.trim();
    if (!t || (t[0] !== "{" && t[0] !== "[")) return undefined;
    try { return JSON.parse(t); } catch { return undefined; }
  }

  function typeOf(v) {
    if (v === null) return "null";
    if (Array.isArray(v)) return "array";
    if (typeof v === "number") return Number.isInteger(v) ? "integer" : "number";
    return typeof v;
  }

  function mergeNode(node, value) {
    if (!node) node = { types: new Set(), values: new Set(), required: null, seen: new Set(), props: {}, items: null, count: 0 };
    node.count++;
    const t = typeOf(value);
    node.types.add(t);
    if (t === "object" && value) {
      const keys = Object.keys(value);
      const ks = new Set(keys);
      if (node.required === null) node.required = new Set(keys);
      else for (const k of [...node.required]) if (!ks.has(k)) node.required.delete(k);
      for (const k of keys) { node.seen.add(k); node.props[k] = mergeNode(node.props[k], value[k]); }
    } else if (t === "array") {
      for (const item of value) node.items = mergeNode(node.items, item);
    } else if (t === "string" || t === "integer" || t === "number" || t === "boolean") {
      // FIX: exclude null from scalar value accumulation
      if (node.values.size <= MAX_ENUM + 1) node.values.add(value);
    }
    return node;
  }

  function nodeToSchema(node) {
    if (!node) return {};
    const types = [...node.types];
    const schema = {};
    if (types.length === 1) schema.type = types[0];
    else if (types.length > 1) schema.type = types;
    if (node.types.has("object")) {
      if (Object.keys(node.props).length) {
        schema.properties = {};
        for (const k of Object.keys(node.props)) schema.properties[k] = nodeToSchema(node.props[k]);
      }
      if (node.required && node.required.size) schema.required = [...node.required].sort();
    }
    if (node.types.has("array") && node.items) schema.items = nodeToSchema(node.items);
    const scalarOnly = types.every((t) => ["string","integer","number","boolean"].includes(t));
    if (scalarOnly && node.values.size > 0) {
      if (node.values.size <= MAX_ENUM) schema.enum = [...node.values];
      else schema.examples = [[...node.values][0]]; // inline example from first observed value
    }
    return schema;
  }

  // ── operationId generation ────────────────────────────────
  // Produces camelCase ids like "getUserById" from "GET /users/{id}"
  function makeOperationId(method, path) {
    const segments = path.split("/").filter(Boolean);
    const words = [method.toLowerCase()];
    for (const seg of segments) {
      if (seg.startsWith("{") && seg.endsWith("}")) {
        const inner = seg.slice(1, -1);
        words.push("By" + inner[0].toUpperCase() + inner.slice(1));
      } else {
        // remove non-alphanum and titleCase
        const clean = seg.replace(/[^a-zA-Z0-9]+/g, " ").trim();
        if (!clean) continue;
        const titled = clean.replace(/\b\w/g, (c) => c.toUpperCase());
        words.push(titled.replace(/\s+/g, ""));
      }
    }
    return words.join("") || `${method.toLowerCase()}Root`;
  }

  // ── Query parameter deduplication ────────────────────────
  // Collect all query-param keys observed for a given operation
  function mergeQueryParams(existing, searchParams) {
    if (!searchParams || typeof searchParams !== "object") return existing;
    for (const [key, value] of Object.entries(searchParams)) {
      if (!existing[key]) existing[key] = { name: key, values: new Set(), count: 0 };
      existing[key].count++;
      if (existing[key].values.size <= MAX_ENUM + 1) existing[key].values.add(value);
    }
    return existing;
  }

  function queryParamsToOpenApi(qpMap) {
    return Object.values(qpMap).map(({ name, values, count }) => {
      const param = {
        name,
        in: "query",
        required: false,
        schema: { type: "string" },
        "x-hyper-rb-count": count,
      };
      if (values.size > 0 && values.size <= MAX_ENUM) param.schema.enum = [...values];
      else if (values.size > 0) param.example = [...values][0];
      return param;
    });
  }

  function buildDocument(requests) {
    const hosts = new Set();
    // key -> { method, path, host, reqSamples, reqNode, reqExample,
    //          resByStatus:{st->{node,count,mime,example}}, count, queryParams }
    const ops = new Map();

    for (const r of requests) {
      if (!r || !r.url || !r.method) continue;
      hosts.add(r.host);
      const path = S.normalizePath(r.pathname || "/");
      const key = `${r.method.toUpperCase()}|${r.host}|${path}`;
      let op = ops.get(key);
      if (!op) {
        op = {
          method: r.method.toUpperCase(),
          path,
          host: r.host,
          count: 0,
          reqNode: null,
          reqSamples: 0,
          reqExample: null,
          resByStatus: {},
          queryParams: {},
        };
        ops.set(key, op);
      }
      op.count++;

      // Collect query parameters
      mergeQueryParams(op.queryParams, r.searchParams);

      // req body
      if (r.reqBody && op.reqSamples < MAX_SAMPLES) {
        const parsed = tryJson(r.reqBody);
        if (parsed !== undefined) {
          op.reqNode = mergeNode(op.reqNode, parsed);
          op.reqSamples++;
          if (!op.reqExample) op.reqExample = parsed;
        }
      }

      // res body — FIX: track mime per status-code, not globally
      const st = typeof r.status === "number" ? String(r.status) : "default";
      const resMime = (() => {
        const ct = (r.resHeaders && (r.resHeaders["content-type"] || r.resHeaders["Content-Type"])) || "";
        return ct ? ct.split(";")[0].trim() : "application/json";
      })();

      if (r.resBody) {
        const parsed = tryJson(r.resBody);
        if (parsed !== undefined) {
          if (!op.resByStatus[st]) op.resByStatus[st] = { node: null, count: 0, mime: resMime, example: null };
          const g = op.resByStatus[st];
          if (g.count < MAX_SAMPLES) {
            g.node = mergeNode(g.node, parsed);
            g.count++;
            if (!g.example) g.example = parsed;
          }
        }
      }
    }

    // ── Build components/schemas (one entry per unique operation response) ──
    const componentsSchemas = {};
    const schemaUsageCount = {};

    function registerSchema(name, schema) {
      // simple dedup by JSON fingerprint
      const fp = JSON.stringify(schema);
      if (!componentsSchemas[name]) {
        componentsSchemas[name] = { schema, fp };
        schemaUsageCount[name] = 0;
      }
      schemaUsageCount[name]++;
      return name;
    }

    function schemaNameFromOp(method, path, suffix) {
      const seg = path.replace(/\{[^}]+\}/g, "ById").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "");
      return `${method[0].toUpperCase()}${method.slice(1).toLowerCase()}${seg ? "_" + seg : ""}${suffix}`;
    }

    const paths = {};
    for (const op of ops.values()) {
      if (!paths[op.path]) paths[op.path] = {};
      const verb = op.method.toLowerCase();
      const operation = {
        operationId: makeOperationId(op.method, op.path),
        summary: `${op.method} ${op.path}`,
        tags: [op.host],
        "x-hyper-rb-count": op.count,
        parameters: [],
        responses: {},
      };

      // Query parameters
      const qpList = queryParamsToOpenApi(op.queryParams);
      if (qpList.length) operation.parameters = qpList;
      else delete operation.parameters;

      // requestBody
      if (op.reqNode) {
        const reqSchema = nodeToSchema(op.reqNode);
        operation.requestBody = {
          required: true,
          content: {
            "application/json": {
              schema: reqSchema,
              ...(op.reqExample ? { example: op.reqExample } : {}),
            },
          },
        };
      }

      // responses — FIX: use per-status mime type
      for (const [st, g] of Object.entries(op.resByStatus)) {
        const schema = nodeToSchema(g.node);
        // Register in components if it's an object schema worth naming
        let contentSchema = schema;
        if (schema.type === "object" || schema.type === "array") {
          const compName = schemaNameFromOp(op.method, op.path, `_${st}`);
          registerSchema(compName, schema);
          contentSchema = { "$ref": `#/components/schemas/${compName}` };
        }
        operation.responses[st] = {
          description: `HTTP ${st} (${g.count} sample(s))`,
          content: {
            [g.mime]: {
              schema: contentSchema,
              ...(g.example ? { example: g.example } : {}),
            },
          },
        };
      }
      if (!Object.keys(operation.responses).length) {
        operation.responses["default"] = { description: "Response" };
      }
      paths[op.path][verb] = operation;
    }

    // Only include components that are referenced at least once
    const doc = {
      openapi: "3.1.0",
      info: {
        title: "Hyper RB — OpenAPI Export",
        version: new Date().toISOString().slice(0, 10),
        description: `Gerado a partir de ${requests.length} requests capturadas em ${hosts.size} host(s).`,
      },
      servers: [...hosts].sort().map((h) => ({ url: `https://${h}` })),
      paths,
    };

    // Attach components/schemas only if populated
    const namedSchemas = Object.fromEntries(
      Object.entries(componentsSchemas).map(([k, v]) => [k, v.schema])
    );
    if (Object.keys(namedSchemas).length) {
      doc.components = { schemas: namedSchemas };
    }

    return doc;
  }

  const SCRIPT = {
    id: 22,
    slug: "openapi-exporter",
    name: "OpenAPI 3.1 Export",
    description: "Gera OpenAPI 3.1 standalone com schemas, operationIds, query params e components/schemas inferidos.",
    icon: "📋",
    needsAI: false,
    needsNetwork: false,
    minRequests: 1,

    async run(ctx) {
      if (!ctx.requests.length) return { ok: false, error: "Capture pelo menos 1 request antes." };
      const doc = buildDocument(ctx.requests);
      const pathCount = Object.keys(doc.paths).length;
      if (!pathCount) return { ok: false, error: "Nenhum path válido identificado." };
      const componentCount = doc.components ? Object.keys(doc.components.schemas || {}).length : 0;
      const json = JSON.stringify(doc, null, 2);
      const filename = `hyper-rb-openapi-${Date.now()}.json`;

      return {
        ok: true,
        summary: `${pathCount} paths · ${doc.servers.length} server(s)${componentCount ? " · " + componentCount + " schemas" : ""}`,
        artifact: { filename, mime: "application/json", content: json },
        render(mountEl) {
          const rows = Object.entries(doc.paths).map(([p, methods]) =>
            Object.keys(methods).map((m) => {
              const op = methods[m];
              const qpCount = (op.parameters || []).length;
              return `
              <tr>
                <td style="font-weight:800;color:#bf00ff;font-size:10px">${S.escapeHtml(m.toUpperCase())}</td>
                <td style="font-family:ui-monospace,monospace;font-size:10px">${S.escapeHtml(p)}</td>
                <td style="text-align:right;font-size:10px;color:rgba(255,255,255,.5)">${op["x-hyper-rb-count"] || 0}×</td>
                <td style="font-size:10px;color:rgba(255,255,255,.5)">${Object.keys(op.responses || {}).join(", ")}</td>
                <td style="font-size:10px;color:rgba(255,255,255,.4)">${qpCount ? qpCount + " QP" : ""}</td>
              </tr>`;
            }).join("")
          ).join("");
          mountEl.innerHTML = `
            <div class="hyper-rb-section">
              <div class="hyper-rb-section-head">
                <div>
                  <div class="hyper-rb-section-title">OpenAPI 3.1 Export</div>
                  <div class="hyper-rb-section-sub">${pathCount} paths · ${doc.servers.length} server(s)${componentCount ? " · " + componentCount + " components/schemas" : ""}</div>
                </div>
                <button class="hyper-rb-btn hyper-rb-btn-primary dl-oa">⬇ Baixar openapi.json</button>
              </div>
              <table class="hyper-rb-table">
                <thead><tr><th>Method</th><th>Path</th><th style="text-align:right">Hits</th><th>Status</th><th>QP</th></tr></thead>
                <tbody>${rows}</tbody>
              </table>
            </div>`;
          mountEl.querySelector(".dl-oa")?.addEventListener("click", () => {
            S.downloadBlob(filename, "application/json", json);
          });
        },
      };
    },
  };

  window.HYPER_RB_SCRIPTS = window.HYPER_RB_SCRIPTS || [];
  window.HYPER_RB_SCRIPTS.push(SCRIPT);
})();

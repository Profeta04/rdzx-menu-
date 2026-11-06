// ============================================================
// Hyper RB · Scripts · #14 response-schema
// Infere JSON Schema (Draft 2020-12) a partir dos response bodies,
// agrupados por method+host+pathname (mesmo agrupador de #1).
// Sem IA, sem rede.
// FIX (Wave 1 · Agent C): removido additionalProperties:false
// FIX (Wave 1 · Agent G):
//   - inferência de `format` para strings (uuid, date-time, uri, email, ipv4)
//   - campo `examples` com amostra real dos valores capturados
//   - extração de $defs para schemas de array items (objetos)
//   - enum corrigido: null não contamina enum de tipos escalares
// ============================================================
(function registerScript() {
  "use strict";
  const S = window.HYPER_RB_SHARED;
  if (!S) { console.error("[Hyper RB · response-schema] HYPER_RB_SHARED ausente"); return; }

  const MAX_ENUM = 5;
  const MAX_SAMPLES_PER_GROUP = 20;
  const MAX_EXAMPLES = 2;

  // ── Format detection patterns ─────────────────────────────
  const _FMT_UUID   = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const _FMT_DATE   = /^\d{4}-\d{2}-\d{2}$/;
  const _FMT_DT     = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
  const _FMT_EMAIL  = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const _FMT_URI    = /^https?:\/\//i;
  const _FMT_IPV4   = /^(?:\d{1,3}\.){3}\d{1,3}$/;

  /** Infer JSON Schema `format` keyword from a set of sampled string values. */
  function inferStringFormat(values) {
    if (!values || values.size === 0) return undefined;
    const arr = [...values].filter((v) => typeof v === "string");
    if (!arr.length) return undefined;
    // All samples must match the same format
    for (const [re, fmt] of [
      [_FMT_UUID,  "uuid"],
      [_FMT_DT,   "date-time"],
      [_FMT_DATE,  "date"],
      [_FMT_EMAIL, "email"],
      [_FMT_URI,   "uri"],
      [_FMT_IPV4,  "ipv4"],
    ]) {
      if (arr.every((v) => re.test(v))) return fmt;
    }
    return undefined;
  }

  function tryParseJson(str) {
    if (typeof str !== "string" || !str) return undefined;
    const s = str.trim();
    if (!s || (s[0] !== "{" && s[0] !== "[")) return undefined;
    try { return JSON.parse(s); } catch { return undefined; }
  }

  function typeOf(v) {
    if (v === null) return "null";
    if (Array.isArray(v)) return "array";
    if (typeof v === "number") return Number.isInteger(v) ? "integer" : "number";
    return typeof v; // string, boolean, object
  }

  // Merge a sample value into an accumulator node.
  // Node shape: { types:Set, values:Set (for scalars), required:Set, seen:Set, props:{}, items:node, count:number }
  function mergeNode(node, value) {
    if (!node) node = { types: new Set(), values: new Set(), required: null, seen: new Set(), props: {}, items: null, count: 0 };
    node.count++;
    const t = typeOf(value);
    node.types.add(t);

    if (t === "object" && value) {
      const keys = Object.keys(value);
      const keySet = new Set(keys);
      if (node.required === null) {
        node.required = new Set(keys);
      } else {
        for (const k of [...node.required]) if (!keySet.has(k)) node.required.delete(k);
      }
      for (const k of keys) {
        node.seen.add(k);
        node.props[k] = mergeNode(node.props[k], value[k]);
      }
    } else if (t === "array") {
      for (const item of value) node.items = mergeNode(node.items, item);
    } else if (t === "string" || t === "integer" || t === "number" || t === "boolean") {
      // FIX: only accumulate scalar values for enum/examples (null excluded)
      if (node.values.size <= MAX_ENUM + 1) node.values.add(value);
    }
    return node;
  }

  // ── $defs hoisting ────────────────────────────────────────
  // After building a schema, extract object schemas that appear as array
  // items (or deeply-nested array items) into top-level $defs, replacing
  // them with $ref references. This produces cleaner, more readable output.

  function _capitalize(s) { return s ? s[0].toUpperCase() + s.slice(1) : "Item"; }

  function hoistArrayItemDefs(topSchema) {
    const defs = {};
    const used = new Set();

    function genName(hint) {
      let base = _capitalize(hint || "Item");
      // strip trailing 's' for plural → singular (items → Item, users → User)
      if (base.endsWith("s") && base.length > 3) base = base.slice(0, -1);
      let name = base;
      let n = 2;
      while (used.has(name)) name = base + n++;
      used.add(name);
      return name;
    }

    function walk(node, hint) {
      if (!node || typeof node !== "object") return node;
      // Recurse into properties first
      if (node.properties) {
        const newProps = {};
        for (const [k, v] of Object.entries(node.properties)) {
          newProps[k] = walk(v, k);
        }
        node = { ...node, properties: newProps };
      }
      // Hoist object items into $defs
      if (node.items && node.items.type === "object" && node.items.properties) {
        const defName = genName(hint);
        defs[defName] = walk(node.items, defName);
        return { ...node, items: { "$ref": `#/$defs/${defName}` } };
      }
      // Recurse into items if not hoisting
      if (node.items) {
        return { ...node, items: walk(node.items, hint ? hint + "Item" : "Item") };
      }
      return node;
    }

    const result = walk(topSchema, "Root");
    if (Object.keys(defs).length) {
      return { ...result, $defs: defs };
    }
    return result;
  }

  function nodeToSchema(node) {
    if (!node) return {};
    const types = [...node.types];
    const schema = {};

    if (types.length === 1) {
      schema.type = types[0];
    } else if (types.length > 1) {
      // Draft 2020-12: type can be an array
      schema.type = types;
    }

    if (node.types.has("object")) {
      if (Object.keys(node.props).length) {
        schema.properties = {};
        for (const k of Object.keys(node.props)) schema.properties[k] = nodeToSchema(node.props[k]);
      }
      if (node.required && node.required.size) schema.required = [...node.required].sort();
      // NOTE: deliberately omit additionalProperties to avoid over-constraining inferred schemas
    }
    if (node.types.has("array") && node.items) {
      schema.items = nodeToSchema(node.items);
    }

    // FIX: only emit enum/examples for purely scalar types (null excluded)
    const scalarTypes = types.filter((t) => t === "string" || t === "integer" || t === "number" || t === "boolean");
    const hasOnlyScalars = types.length > 0 && types.every((t) => scalarTypes.includes(t));
    if (hasOnlyScalars && node.values.size > 0) {
      if (node.values.size <= MAX_ENUM) {
        schema.enum = [...node.values];
      } else {
        // Not an enum — but provide examples (Draft 2020-12 `examples` keyword)
        schema.examples = [...node.values].slice(0, MAX_EXAMPLES);
      }
    }

    // String format inference (only when all sampled values are strings)
    if (node.types.size === 1 && node.types.has("string") && node.values.size > 0) {
      const fmt = inferStringFormat(node.values);
      if (fmt) schema.format = fmt;
    }

    return schema;
  }

  function groupKey(r) {
    return `${r.method} ${r.host}${S.normalizePath(r.pathname)}`;
  }

  function inferAll(requests) {
    const groups = new Map();
    for (const r of requests) {
      if (!r || !r.resBody) continue;
      const parsed = tryParseJson(r.resBody);
      if (parsed === undefined) continue;
      const key = groupKey(r);
      let g = groups.get(key);
      if (!g) { g = { key, samples: 0, node: null, sample: parsed, statuses: new Set() }; groups.set(key, g); }
      if (g.samples >= MAX_SAMPLES_PER_GROUP) continue;
      g.node = mergeNode(g.node, parsed);
      g.samples++;
      if (typeof r.status === "number") g.statuses.add(r.status);
    }
    const out = [];
    for (const g of groups.values()) {
      const rawSchema = {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        title: g.key,
        ...nodeToSchema(g.node),
      };
      out.push({
        key: g.key,
        samples: g.samples,
        statuses: [...g.statuses].sort((a, b) => a - b),
        // IMPROVEMENT: hoist array item objects into $defs for cleaner schemas
        schema: hoistArrayItemDefs(rawSchema),
      });
    }
    return out;
  }

  const SCRIPT = {
    id: 14,
    slug: "response-schema",
    name: "Response Schema",
    description: "Infere JSON Schema (Draft 2020-12) a partir dos response bodies, agrupado por endpoint. Detecta formats (uuid, date-time, uri…) e extrai $defs para array items.",
    icon: "🧬",
    needsAI: false,
    needsNetwork: false,
    minRequests: 1,

    async run(ctx) {
      const groups = inferAll(ctx.requests);
      if (!groups.length) {
        return { ok: false, error: "Nenhuma response JSON válida encontrada." };
      }

      const bundle = {
        generatedAt: new Date().toISOString(),
        totalGroups: groups.length,
        schemas: groups.map((g) => ({ endpoint: g.key, samples: g.samples, statuses: g.statuses, schema: g.schema })),
      };
      const json = JSON.stringify(bundle, null, 2);
      const filename = `hyper-rb-schemas-${Date.now()}.json`;

      return {
        ok: true,
        summary: `${groups.length} schema(s) inferido(s)`,
        artifact: { filename, mime: "application/json", content: json },
        render(mountEl) {
          const rows = groups.map((g, i) => `
            <tr>
              <td>${S.escapeHtml(g.key)}</td>
              <td style="text-align:right">${g.samples}</td>
              <td style="text-align:center;font-size:10px;color:rgba(255,255,255,.5)">${g.statuses.join(", ") || "—"}</td>
              <td style="text-align:center;font-size:10px;color:rgba(255,255,255,.4)">${g.schema.$defs ? Object.keys(g.schema.$defs).length + " $def(s)" : ""}</td>
              <td><button class="hyper-rb-btn show-schema" data-idx="${i}">Ver schema</button></td>
            </tr>
          `).join("");

          mountEl.innerHTML = `
            <div class="hyper-rb-section">
              <div class="hyper-rb-section-head">
                <div>
                  <div class="hyper-rb-section-title">Response Schema</div>
                  <div class="hyper-rb-section-sub">
                    ${S.escapeHtml(String(groups.length))} endpoint(s) com response JSON.
                    Enum inferido quando ≤ ${MAX_ENUM} valores distintos.
                    Formats detectados: uuid, date-time, date, email, uri, ipv4.
                  </div>
                </div>
                <button class="hyper-rb-btn hyper-rb-btn-primary dl-schemas">⬇ Baixar schemas.json</button>
              </div>
              <table class="hyper-rb-table">
                <thead><tr><th>Endpoint</th><th style="text-align:right">Samples</th><th style="text-align:center">Status</th><th style="text-align:center">$defs</th><th></th></tr></thead>
                <tbody>${rows}</tbody>
              </table>
              <pre class="hyper-rb-pre schema-preview" style="max-height:360px;overflow:auto;display:none"><code></code></pre>
            </div>
          `;

          const pre = mountEl.querySelector(".schema-preview");
          const code = pre?.querySelector("code");
          mountEl.querySelectorAll(".show-schema").forEach((btn) => {
            btn.addEventListener("click", () => {
              const idx = Number(btn.getAttribute("data-idx"));
              const g = groups[idx];
              if (!g || !pre || !code) return;
              code.textContent = JSON.stringify(g.schema, null, 2);
              pre.style.display = "block";
              pre.scrollIntoView({ behavior: "smooth", block: "nearest" });
            });
          });
          mountEl.querySelector(".dl-schemas")?.addEventListener("click", () => {
            S.downloadBlob(filename, "application/json", json);
          });
        },
      };
    },
  };

  window.HYPER_RB_SCRIPTS = window.HYPER_RB_SCRIPTS || [];
  window.HYPER_RB_SCRIPTS.push(SCRIPT);
})();

// ============= Lines 1-64 of 5018 total lines =============

1: ;!function() {
2:     try {
3:         var e = "undefined" != typeof globalThis ? globalThis : "undefined" != typeof global ? global : "undefined" != typeof window ? window : "undefined" != typeof self ? self : {}
4:           , n = (new e.Error).stack;
5:         n && ((e._debugIds || (e._debugIds = {}))[n] = "226d2970-e62f-189e-6b6d-11c1202604cf")
6:     } catch (e) {}
7: }();
8: (globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push(["object" == typeof document ? document.currentScript : void 0, 939868, 715026, e => {
9:     "use strict";
10:     var t = e.i(676122);
11:     let r = ["supabase", "supabase_lov", "supply_chain", "connector_security_scan"]
12:       , s = ["agent_security"]
13:       , i = "tanstack"
14:       , a = new Set(r)
15:       , n = new Map([["agent_security", 0], [i, 1]]);
16:     function o(e) {
17:         return new Set((0,
18:         t.filterActiveScanContexts)(e).flatMap(e => e.scanners ?? []))
19:     }
20:     function l({scanData: e, force: t=!1}) {
21:         let s = o(e?.scan_contexts);
22:         return r.filter(r => m(e, r, s, t))
23:     }
24:     function c({scanData: e, includeTanstack: t, isModernTechStack: r, force: s=!1}) {
25:         let a = o(e?.scan_contexts)
26:           , n = []
27:           , l = m(e, "agent_security", a, s)
28:           , d = t && r && m(e, i, a, s);
29:         return l && n.push("agent_security"),
30:         d && n.push(i),
31:         n
32:     }
33:     function d(e) {
34:         return e.map(e => ({
35:             name: e.name,
36:             level: e.level
37:         }))
38:     }
39:     function u(e, {includeTanstack: t, isModernTechStack: r}) {
40:         return !a.has(e) && (e !== i || t && r)
41:     }
42:     function m(e, t, r, s) {
43:         return !r.has(t) && (!!s || e?.results?.[t]?.isScanUpToDate !== !0)
44:     }
45:     function p(e, r, s=new Map) {
46:         return e?.results ? r.flatMap( (r, s) => (e.results?.[r]?.items ?? []).filter(t.isActionableSecurityFinding).map( (e, t) => ({
47:             finding: e,
48:             scannerName: r,
49:             scannerIndex: s,
50:             itemIndex: t
51:         }))).sort( (e, t) => {
52:             let r = g(e.finding) - g(t.finding);
53:             if (0 !== r)
54:                 return r;
55:             let i = (s.get(e.scannerName) ?? e.scannerIndex) - (s.get(t.scannerName) ?? t.scannerIndex);
56:             return 0 !== i ? i : e.itemIndex - t.itemIndex
57:         }
58:         ).map( ({finding: e}) => e) : []
59:     }
60:     function g(e) {
61:         return +("error" !== e.level)
62:     }
63:     e.s(["QUICK_SECURITY_SCANNERS", 0, r, "getActiveInDepthSecurityScanStartedAt", 0, function(e, {includeTanstack: r, isModernTechStack: s}) {
64:         let i = (0,

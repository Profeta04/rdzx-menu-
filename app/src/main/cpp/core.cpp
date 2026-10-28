#include "zdrx.h"

#include <android/log.h>
#include <cstdarg>
#include <cstdio>
#include <cstring>
#include <deque>
#include <sstream>

#define TAG "ZDRX"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, TAG, __VA_ARGS__)

namespace zdrx {

State S;

const Feature FEATURES[F_COUNT] = {
    {"esp",       "ESP",              T_BOOL,  1,   0,    1},
    {"esp_box",   "Caixas",           T_BOOL,  1,   0,    1},
    {"esp_name",  "Identificacao",    T_BOOL,  1,   0,    1},
    {"esp_dist",  "Distancia",        T_BOOL,  1,   0,    1},
    {"esp_line",  "Linhas",           T_BOOL,  0,   0,    1},
    {"esp_hp",    "Barra de vida",    T_BOOL,  1,   0,    1},

    {"aim",       "Aimbot",           T_BOOL,  0,   0,    1},
    {"aim_fov",   "FOV",              T_RANGE, 120, 10,   900},
    {"aim_gain",  "Ganho",            T_RANGE, 700, 50,   4000},
    {"aim_damp",  "Amortecimento",    T_RANGE, 120, 0,    2000},
    {"aim_lead",  "Antecipacao (ms)", T_RANGE, 90,  0,    400},
    {"aim_dead",  "Zona morta",       T_RANGE, 6,   0,    60},

    {"norecoil",  "Sem recuo",        T_BOOL,  0,   0,    1},
    {"fastland",  "Queda rapida",     T_BOOL,  0,   0,    1},
    {"ghost",     "Ghost",            T_BOOL,  0,   0,    1},
    {"magic",     "Magic bullet",     T_BOOL,  0,   0,    1},
    {"lockb",     "Trava de campos",  T_BOOL,  1,   0,    1},
    {"cmdf",      "Comandos",         T_BOOL,  1,   0,    1},

    {"capture",   "Captura",          T_BOOL,  0,   0,    1},
    {"trace",     "Trace",            T_BOOL,  1,   0,    1}
};

static std::deque<std::string> g_trace;

void log(const char* fmt, ...) {
    char b[256];
    va_list ap;
    va_start(ap, fmt);
    vsnprintf(b, sizeof b, fmt, ap);
    va_end(ap);

    std::lock_guard<std::recursive_mutex> lk(S.m);
    if (S.cfg[F_TRACE]) {
        g_trace.emplace_back(b);
        if (g_trace.size() > 400) g_trace.pop_front();
    }
    LOGI("%s", b);
}

static void apply_defaults() {
    for (int i = 0; i < F_COUNT; i++) S.cfg[i] = FEATURES[i].def;
}

void boot(bool enable) {
    std::lock_guard<std::recursive_mutex> lk(S.m);

    if (enable) {
        if (!S.live) {
            apply_defaults();
            S.live = true;
            log("zdrx: motor ONLINE (%d features)", F_COUNT);
        }
        return;
    }

    if (S.live) {
        S.live = false;
        log("zdrx: motor offline");
    }
    wipe();
}

void wipe() {
    std::lock_guard<std::recursive_mutex> lk(S.m);
    S.ents.clear();
    S.out.clear();
    S.lockId = 0;
    S.lockState = 0;
    S.lockUntil = 0;
    S.errX = S.errY = 0;
    S.aimHits = 0;
    S.seen = S.kept = S.mod = S.dropped = S.sent = 0;
    S.self = Vec3{};
    log("zdrx: estado limpo");
}

void set(int f, int v) {
    std::lock_guard<std::recursive_mutex> lk(S.m);
    if (f < 0 || f >= F_COUNT) return;

    if (FEATURES[f].type == T_BOOL) {
        v = v ? 1 : 0;
    } else {
        if (v < FEATURES[f].lo) v = FEATURES[f].lo;
        if (v > FEATURES[f].hi) v = FEATURES[f].hi;
    }

    S.cfg[f] = v;

    if (f == F_ESP || f == F_AIM) {
        S.lockId = 0;
        S.lockState = 0;
        S.errX = S.errY = 0;
    }
    log("set %s = %d", FEATURES[f].key, v);
}

void set_json(const std::string& json) {
    for (int i = 0; i < F_COUNT; i++) {
        std::string k = std::string("\"") + FEATURES[i].key + "\"";
        size_t p = json.find(k);
        if (p == std::string::npos) continue;
        p = json.find(':', p + k.size());
        if (p == std::string::npos) continue;
        set(i, atoi(json.c_str() + p + 1));
    }
}

std::string cfg_json() {
    std::lock_guard<std::recursive_mutex> lk(S.m);
    std::ostringstream o;
    o << '{';
    for (int i = 0; i < F_COUNT; i++) {
        if (i) o << ',';
        o << '"' << FEATURES[i].key << "\":" << S.cfg[i];
    }
    o << '}';
    return o.str();
}

std::string status_json() {
    std::lock_guard<std::recursive_mutex> lk(S.m);
    std::ostringstream o;
    o << "{\"live\":"      << (S.live ? "true" : "false")
      << ",\"ents\":"      << S.ents.size()
      << ",\"queue\":"     << S.out.size()
      << ",\"lock\":"      << S.lockId
      << ",\"lockState\":" << S.lockState
      << ",\"seen\":"      << S.seen
      << ",\"kept\":"      << S.kept
      << ",\"mod\":"       << S.mod
      << ",\"dropped\":"   << S.dropped
      << ",\"sent\":"      << S.sent
      << ",\"aimHits\":"   << S.aimHits << '}';
    return o.str();
}

std::string trace_drain() {
    std::lock_guard<std::recursive_mutex> lk(S.m);
    std::string out;
    for (auto& l : g_trace) { out += l; out += '\n'; }
    g_trace.clear();
    return out;
}

void tick() {
    std::lock_guard<std::recursive_mutex> lk(S.m);
    int64_t now = now_ms();

    if (S.lockUntil && now > S.lockUntil) {
        S.lockState = 0;
        S.lockId = 0;
        S.lockUntil = 0;
    }

    for (auto it = S.ents.begin(); it != S.ents.end(); ) {
        if (now - it->second.t1 >= 3000) it = S.ents.erase(it);
        else ++it;
    }
}

} // namespace zdrx

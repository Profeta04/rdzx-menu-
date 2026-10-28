#pragma once

#include <cstdint>
#include <cstddef>
#include <mutex>
#include <map>
#include <vector>
#include <string>
#include <chrono>

namespace zdrx {

using Clock = std::chrono::steady_clock;

inline int64_t now_ms() {
    return std::chrono::duration_cast<std::chrono::milliseconds>(
               Clock::now().time_since_epoch()).count();
}

/* Registro declarativo de features: a UI Java se auto-constroi a partir
   desta tabela via JNI, sem nenhuma lista hardcoded no lado Android. */

enum Type : int { T_BOOL = 0, T_INT, T_RANGE };

struct Feature {
    const char* key;
    const char* label;
    Type        type;
    int         def;
    int         lo, hi;
};

enum : int {
    F_ESP = 0,
    F_ESP_BOX, F_ESP_NAME, F_ESP_DIST, F_ESP_LINE, F_ESP_HP,
    F_AIM, F_AIM_FOV, F_AIM_GAIN, F_AIM_DAMP, F_AIM_LEAD, F_AIM_DEAD,
    F_NORECOIL, F_FASTLAND, F_GHOST, F_MAGIC, F_LOCKB, F_CMDF,
    F_CAPTURE, F_TRACE,
    F_COUNT
};

extern const Feature FEATURES[F_COUNT];

struct Vec3 { float x = 0, y = 0, z = 0; };

struct Ent {
    int32_t id   = 0;
    Vec3    cur, dst, vel;
    int64_t t0 = 0, t1 = 0;
    float   hp = 0;
    int32_t team = 0;
};

struct State {
    std::recursive_mutex m;

    int     cfg[F_COUNT] = {0};
    bool    live = false;

    Vec3    self;
    float   yaw = 0, pitch = 0;

    int32_t lockId = 0;
    int32_t lockState = 0;
    int64_t lockUntil = 0;
    float   errX = 0, errY = 0;
    int64_t lastAim = 0;
    int64_t aimHits = 0;

    std::map<int32_t, Ent> ents;
    std::vector<std::vector<uint8_t>> out;

    uint64_t seen = 0, kept = 0, mod = 0, dropped = 0, sent = 0;
};

extern State S;

inline bool on(int f)  { return f >= 0 && f < F_COUNT && S.cfg[f] != 0; }
inline int  val(int f) { return (f >= 0 && f < F_COUNT) ? S.cfg[f] : 0; }

void   boot(bool enable);
void   wipe();
void   set(int f, int v);
void   set_json(const std::string& json);
std::string cfg_json();
std::string status_json();
std::string trace_drain();
void   log(const char* fmt, ...);
void   tick();

bool   looks_like_game(const uint8_t* p, size_t n);
int    on_s2c(std::vector<uint8_t>& p);
int    on_c2s(std::vector<uint8_t>& p);
int    drain_out(std::vector<std::vector<uint8_t>>& v);

int    drain_into(float* o, int cap);
void   ingest(const uint8_t* body, size_t len);
void   lock_from(const uint8_t* body, size_t len);

bool   aim_solve(int32_t cx, int32_t cy, int32_t& ox, int32_t& oy);
bool   firing();

} // namespace zdrx

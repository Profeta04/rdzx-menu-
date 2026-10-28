#include "zdrx.h"

namespace zdrx {

/* Registro de entidade (20 bytes):
     +0 i32 id | +4 i32 x | +8 i32 y | +12 i32 z | +16 u16 vida | +18 u16 time */

static constexpr size_t  REC      = 20;
static constexpr int64_t HOT      = 2500;
static constexpr int64_t LERP_MAX = 200;

static inline uint32_t rd32(const uint8_t* p) {
    return (uint32_t)p[0] | ((uint32_t)p[1] << 8) |
           ((uint32_t)p[2] << 16) | ((uint32_t)p[3] << 24);
}
static inline uint16_t rd16(const uint8_t* p) { return (uint16_t)(p[0] | (p[1] << 8)); }

void ingest(const uint8_t* body, size_t len) {
    size_t count = len / REC;
    int64_t now = now_ms();

    for (size_t i = 0; i < count; i++) {
        const uint8_t* r = body + i * REC;

        int32_t id = (int32_t)rd32(r);
        if (id == 0) continue;

        float x = (float)(int32_t)rd32(r + 4);
        float y = (float)(int32_t)rd32(r + 8);
        float z = (float)(int32_t)rd32(r + 12);
        float hp = (float)rd16(r + 16) / 10.0f;
        int32_t team = (int32_t)rd16(r + 18);

        auto it = S.ents.find(id);
        if (it == S.ents.end()) {
            Ent e;
            e.id = id;
            e.dst = Vec3{x, y, z};
            e.cur = e.dst;
            e.t0 = 0;
            e.t1 = now;
            e.hp = hp;
            e.team = team;
            S.ents.emplace(id, e);
            S.kept++;
            continue;
        }

        Ent& e = it->second;
        int64_t dt = now - e.t1;
        if (dt > 0) {
            float s = 1000.0f / (float)dt;
            e.vel.x = (x - e.cur.x) * s;
            e.vel.y = (y - e.cur.y) * s;
            e.vel.z = (z - e.cur.z) * s;
        }
        e.cur = e.dst;
        e.dst = Vec3{x, y, z};
        e.t0 = e.t1;
        e.t1 = now;
        e.hp = hp;
        e.team = team;
    }
}

void lock_from(const uint8_t* body, size_t len) {
    size_t count = len / REC;
    if (count <= 4) return;

    int32_t id = (int32_t)rd32(body + 4 * REC);
    if (id == 0) return;

    if (S.lockId == 0) {
        S.lockState = 1;
        log("lock: candidato id=%d", id);
    }
    S.lockId = id;
    S.lockState = 2;
    S.lockUntil = now_ms() + 55000;
    S.errX = S.errY = 0;
    log("lock: ALVO=%d travado", id);
}

/* buffer: [0..2] self | [3] yaw | [4] pitch | [5] n | [6] lockId | [7] estado
           depois 6 floats por entidade: x,y,z (m), id, vida, time */
int drain_into(float* o, int cap) {
    std::lock_guard<std::recursive_mutex> lk(S.m);
    if (!o || cap < 8) return 0;

    o[0] = S.self.x / 1000.0f;
    o[1] = S.self.y / 1000.0f;
    o[2] = S.self.z / 1000.0f;
    o[3] = S.yaw;
    o[4] = S.pitch;

    int n = 0;
    int maxn = (cap - 8) / 6;
    int64_t now = now_ms();

    for (auto it = S.ents.begin(); it != S.ents.end(); ) {
        Ent& e = it->second;

        int64_t age = now - e.t1;
        if (age >= HOT) { it = S.ents.erase(it); continue; }
        if (n >= maxn) break;

        float x = e.cur.x, y = e.cur.y, z = e.cur.z;
        int64_t span = e.t1 - e.t0;

        if (e.t0 && span > 0 && span < 500) {
            int64_t t = age > LERP_MAX ? LERP_MAX : age;
            float f = (float)t / (float)span;
            x = e.cur.x + (e.dst.x - e.cur.x) * f;
            y = e.cur.y + (e.dst.y - e.cur.y) * f;
            z = e.cur.z + (e.dst.z - e.cur.z) * f;
        }

        float* q = o + 8 + n * 6;
        q[0] = x / 1000.0f;
        q[1] = y / 1000.0f;
        q[2] = z / 1000.0f;
        q[3] = (float)e.id;
        q[4] = e.hp;
        q[5] = (float)e.team;
        n++;
        ++it;
    }

    o[5] = (float)n;
    o[6] = (float)S.lockId;
    o[7] = (float)S.lockState;
    return n;
}

} // namespace zdrx

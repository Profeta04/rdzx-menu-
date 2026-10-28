#include "zdrx.h"
#include <cmath>

namespace zdrx {

/* Cabecalho ZDRX (12 bytes):
     0  u16 magic = 0x5A44
     2  u8  versao
     3  u8  tipo
     4  u16 tamanho
     6  u16 flags
     8  u32 sequencia
   Se o magic nao casar, cai no modo CRU (tipo em +0, payload em +2). */

static const uint16_t MAGIC = 0x5A44;

static const uint16_t RAW_TYPES[] = {
    1, 2, 3, 4, 5, 6,
    100, 101, 130, 221,
    0x1bf, 0x1c0, 0x1aa8, 0x1ab0, 0x1fd4, 0x1fdc, 0x1fb8, 0x1fbc,
    0x7da, 0x3cb
};

static bool raw_known(uint16_t t) {
    for (uint16_t k : RAW_TYPES) if (k == t) return true;
    return false;
}

static inline uint16_t rd16(const uint8_t* p) { return (uint16_t)(p[0] | (p[1] << 8)); }
static inline uint32_t rd32(const uint8_t* p) {
    return (uint32_t)p[0] | ((uint32_t)p[1] << 8) |
           ((uint32_t)p[2] << 16) | ((uint32_t)p[3] << 24);
}
static inline void wr32(uint8_t* p, uint32_t v) {
    p[0] = (uint8_t)v; p[1] = (uint8_t)(v >> 8);
    p[2] = (uint8_t)(v >> 16); p[3] = (uint8_t)(v >> 24);
}
static inline uint32_t zz(int32_t v)    { return (uint32_t)((v << 1) ^ (v >> 31)); }
static inline int32_t  unzz(uint32_t v) { return (int32_t)((v >> 1) ^ (~(v & 1) + 1)); }

enum : int { MODE_NONE = 0, MODE_ZDRX = 1, MODE_RAW = 2 };

static int mode_of(const uint8_t* p, size_t n) {
    if (n >= 12 && rd16(p) == MAGIC) return MODE_ZDRX;
    if (n >= 2 && raw_known(rd16(p))) return MODE_RAW;
    return MODE_NONE;
}

bool looks_like_game(const uint8_t* p, size_t n) { return mode_of(p, n) != MODE_NONE; }

struct Head {
    int            mode = MODE_NONE;
    uint8_t        type = 0;
    size_t         off  = 0;
    const uint8_t* body = nullptr;
    size_t         len  = 0;
};

static Head split(const uint8_t* p, size_t n) {
    Head h;
    int m = mode_of(p, n);
    if (m == MODE_ZDRX) {
        uint16_t l = rd16(p + 4);
        h.mode = MODE_ZDRX;
        h.type = p[3];
        h.off  = 12;
        h.body = p + 12;
        h.len  = (l && (size_t)l <= n - 12) ? l : n - 12;
    } else if (m == MODE_RAW) {
        h.mode = MODE_RAW;
        h.type = (uint8_t)rd16(p);
        h.off  = 2;
        h.body = p + 2;
        h.len  = n - 2;
    }
    return h;
}

static constexpr uint8_t T_ENT  = 0x10;
static constexpr uint8_t T_LOCK = 0x11;
static constexpr uint8_t T_DMG  = 0x12;
static constexpr uint8_t T_PART = 0x13;
static constexpr uint8_t T_AIM  = 0x20;
static constexpr uint8_t T_CMD  = 0x21;
static constexpr uint8_t T_NUM  = 0x22;

int on_s2c(std::vector<uint8_t>& p) {
    Head h = split(p.data(), p.size());
    if (h.mode == MODE_NONE) return 0;

    std::lock_guard<std::recursive_mutex> lk(S.m);
    S.seen++;

    switch (h.type) {
        case T_ENT:
            ingest(h.body, h.len);
            break;

        case T_LOCK:
            lock_from(h.body, h.len);
            ingest(h.body, h.len);
            break;

        case T_DMG:
            S.lockUntil = now_ms() + 55000;
            log("S2C dano: janela de 55 s aberta");
            break;

        case T_PART:
            S.out.push_back(p);
            S.sent++;
            break;

        case T_AIM:
            if (S.lockId && on(F_MAGIC)) {
                S.dropped++;
                return 2;
            }
            break;

        default:
            break;
    }
    return 0;
}

int on_c2s(std::vector<uint8_t>& p) {
    Head h = split(p.data(), p.size());
    if (h.mode == MODE_NONE) return 0;

    std::lock_guard<std::recursive_mutex> lk(S.m);
    if (!S.live) return 0;

    uint8_t* b  = p.data() + h.off;
    size_t   bl = p.size() - h.off;

    if (h.type == T_AIM && on(F_AIM) && S.lockState == 2 && bl >= 8) {
        int32_t cx = unzz(rd32(b));
        int32_t cy = unzz(rd32(b + 4));
        int32_t ox = 0, oy = 0;

        if (aim_solve(cx, cy, ox, oy)) {
            wr32(b, zz(ox));
            wr32(b + 4, zz(oy));
            S.out.push_back(p);
            S.mod++;
            S.sent++;
            return 1;
        }
    }

    if (h.type == T_CMD && on(F_CMDF) && S.lockId && bl >= 0x81) {
        wr32(b + 0x20, zz((int32_t)S.self.x));
        wr32(b + 0x30, zz((int32_t)S.self.y));
        wr32(b + 0x40, zz((int32_t)S.self.z));
        S.out.push_back(p);
        S.mod++;
        S.sent++;
        return 1;
    }

    if (h.type == T_NUM && on(F_NORECOIL) && bl >= 0x14) {
        uint32_t campo = rd32(b + 0x10);
        if (campo > 9999) {
            wr32(b + 0x10, campo - 10000);
            S.out.push_back(p);
            S.mod++;
            S.sent++;
            return 1;
        }
    }

    return 0;
}

int drain_out(std::vector<std::vector<uint8_t>>& v) {
    std::lock_guard<std::recursive_mutex> lk(S.m);
    v.swap(S.out);
    return (int)v.size();
}

} // namespace zdrx

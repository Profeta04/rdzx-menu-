#include "zdrx.h"
#include <cmath>

namespace zdrx {

static constexpr float RAD2DEG = 57.2957795f;

/* Solver PD: avanco proporcional ao erro, amortecido pela derivada,
   com antecipacao pela velocidade estimada da entidade. */

bool aim_solve(int32_t cx, int32_t cy, int32_t& ox, int32_t& oy) {
    if (!S.lockId) return false;

    int64_t now = now_ms();
    if (S.lockUntil && now > S.lockUntil) return false;

    auto it = S.ents.find(S.lockId);
    if (it == S.ents.end()) return false;

    const Ent& e = it->second;

    float lead = val(F_AIM_LEAD) / 1000.0f;
    float tx = e.dst.x + e.vel.x * lead;
    float ty = e.dst.y + e.vel.y * lead;
    float tz = e.dst.z + e.vel.z * lead;

    float dx = tx - S.self.x;
    float dy = ty - S.self.y;
    float dz = tz - S.self.z;

    float flat = std::sqrt(dx * dx + dy * dy);
    float dist = std::sqrt(flat * flat + dz * dz);
    if (dist < 1.0f) return false;

    float yawT   = std::atan2(dy, dx) * RAD2DEG;
    float pitchT = std::atan2(dz, flat) * RAD2DEG;

    float yawErr = yawT - S.yaw;
    while (yawErr >  180.0f) yawErr -= 360.0f;
    while (yawErr < -180.0f) yawErr += 360.0f;
    float pitchErr = pitchT - S.pitch;

    float errMag = std::sqrt(yawErr * yawErr + pitchErr * pitchErr);

    if (errMag * 1000.0f > (float)val(F_AIM_FOV) * 4.0f) return false;

    float dead = val(F_AIM_DEAD) / 1000.0f;
    if (errMag < dead) {
        ox = (int32_t)(S.yaw * 1000.0f);
        oy = (int32_t)(S.pitch * 1000.0f);
        return true;
    }

    float dt = (now - S.lastAim) / 1000.0f;
    if (dt <= 0.0f || dt > 0.25f) dt = 1.0f / 60.0f;
    S.lastAim = now;

    float kp = val(F_AIM_GAIN) / 1000.0f;
    float kd = val(F_AIM_DAMP) / 1000.0f;

    float dYaw = (yawErr - S.errX) / dt;
    float dPit = (pitchErr - S.errY) / dt;
    S.errX = yawErr;
    S.errY = pitchErr;

    float uYaw = kp * yawErr + kd * dYaw;
    float uPit = kp * pitchErr + kd * dPit;

    const float MAX_RATE = 6.0f;
    if (uYaw >  MAX_RATE) uYaw =  MAX_RATE;
    if (uYaw < -MAX_RATE) uYaw = -MAX_RATE;
    if (uPit >  MAX_RATE) uPit =  MAX_RATE;
    if (uPit < -MAX_RATE) uPit = -MAX_RATE;

    float nYaw = S.yaw + uYaw * dt;
    float nPit = S.pitch + uPit * dt;

    ox = (int32_t)(nYaw * 1000.0f);
    oy = (int32_t)(nPit * 1000.0f);

    S.aimHits++;
    return true;
}

bool firing() {
    return S.lockState == 2 && S.aimHits > 0;
}

} // namespace zdrx

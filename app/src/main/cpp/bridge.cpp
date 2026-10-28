#include "zdrx.h"
#include <jni.h>

using namespace zdrx;

static std::string js(JNIEnv* env, jstring s) {
    if (!s) return {};
    const char* c = env->GetStringUTFChars(s, nullptr);
    std::string r = c ? c : "";
    if (c) env->ReleaseStringUTFChars(s, c);
    return r;
}

extern "C" JNIEXPORT void JNICALL
Java_io_zdrx_client_Zdrx_boot(JNIEnv*, jclass, jboolean e) { boot(e == JNI_TRUE); }

extern "C" JNIEXPORT void JNICALL
Java_io_zdrx_client_Zdrx_wipe(JNIEnv*, jclass) { wipe(); }

extern "C" JNIEXPORT void JNICALL
Java_io_zdrx_client_Zdrx_set(JNIEnv*, jclass, jint f, jint v) { set(f, v); }

extern "C" JNIEXPORT void JNICALL
Java_io_zdrx_client_Zdrx_setJson(JNIEnv* env, jclass, jstring j) { set_json(js(env, j)); }

extern "C" JNIEXPORT jstring JNICALL
Java_io_zdrx_client_Zdrx_cfgJson(JNIEnv* env, jclass) {
    return env->NewStringUTF(cfg_json().c_str());
}

extern "C" JNIEXPORT jstring JNICALL
Java_io_zdrx_client_Zdrx_statusJson(JNIEnv* env, jclass) {
    return env->NewStringUTF(status_json().c_str());
}

extern "C" JNIEXPORT jstring JNICALL
Java_io_zdrx_client_Zdrx_traceDrain(JNIEnv* env, jclass) {
    return env->NewStringUTF(trace_drain().c_str());
}

extern "C" JNIEXPORT jboolean JNICALL
Java_io_zdrx_client_Zdrx_live(JNIEnv*, jclass) { return S.live ? JNI_TRUE : JNI_FALSE; }

extern "C" JNIEXPORT void JNICALL
Java_io_zdrx_client_Zdrx_tick(JNIEnv*, jclass) { tick(); }

extern "C" JNIEXPORT jint JNICALL
Java_io_zdrx_client_Zdrx_featCount(JNIEnv*, jclass) { return F_COUNT; }

extern "C" JNIEXPORT jstring JNICALL
Java_io_zdrx_client_Zdrx_featKey(JNIEnv* env, jclass, jint i) {
    return env->NewStringUTF((i >= 0 && i < F_COUNT) ? FEATURES[i].key : "");
}

extern "C" JNIEXPORT jstring JNICALL
Java_io_zdrx_client_Zdrx_featLabel(JNIEnv* env, jclass, jint i) {
    return env->NewStringUTF((i >= 0 && i < F_COUNT) ? FEATURES[i].label : "");
}

extern "C" JNIEXPORT jint JNICALL
Java_io_zdrx_client_Zdrx_featType(JNIEnv*, jclass, jint i) {
    return (i >= 0 && i < F_COUNT) ? (jint)FEATURES[i].type : (jint)T_BOOL;
}

extern "C" JNIEXPORT jint JNICALL
Java_io_zdrx_client_Zdrx_featDef(JNIEnv*, jclass, jint i) {
    return (i >= 0 && i < F_COUNT) ? (jint)FEATURES[i].def : 0;
}

extern "C" JNIEXPORT jint JNICALL
Java_io_zdrx_client_Zdrx_featLo(JNIEnv*, jclass, jint i) {
    return (i >= 0 && i < F_COUNT) ? (jint)FEATURES[i].lo : 0;
}

extern "C" JNIEXPORT jint JNICALL
Java_io_zdrx_client_Zdrx_featHi(JNIEnv*, jclass, jint i) {
    return (i >= 0 && i < F_COUNT) ? (jint)FEATURES[i].hi : 1;
}

extern "C" JNIEXPORT jboolean JNICALL
Java_io_zdrx_client_Zdrx_looksLikeGame(JNIEnv* env, jclass, jbyteArray a) {
    if (!a) return JNI_FALSE;
    jsize n = env->GetArrayLength(a);
    if (n < 2) return JNI_FALSE;
    jbyte* b = env->GetByteArrayElements(a, nullptr);
    bool r = looks_like_game((const uint8_t*)b, (size_t)n);
    env->ReleaseByteArrayElements(a, b, JNI_ABORT);
    return r ? JNI_TRUE : JNI_FALSE;
}

extern "C" JNIEXPORT jbyteArray JNICALL
Java_io_zdrx_client_Zdrx_onS2C(JNIEnv* env, jclass, jbyteArray a) {
    if (!a) return nullptr;
    jsize n = env->GetArrayLength(a);
    jbyte* b = env->GetByteArrayElements(a, nullptr);
    std::vector<uint8_t> v((uint8_t*)b, (uint8_t*)b + n);
    env->ReleaseByteArrayElements(a, b, JNI_ABORT);

    if (on_s2c(v) == 0) return nullptr;

    jbyteArray o = env->NewByteArray((jsize)v.size());
    env->SetByteArrayRegion(o, 0, (jsize)v.size(), (const jbyte*)v.data());
    return o;
}

extern "C" JNIEXPORT jbyteArray JNICALL
Java_io_zdrx_client_Zdrx_onC2S(JNIEnv* env, jclass, jbyteArray a) {
    if (!a) return nullptr;
    jsize n = env->GetArrayLength(a);
    jbyte* b = env->GetByteArrayElements(a, nullptr);
    std::vector<uint8_t> v((uint8_t*)b, (uint8_t*)b + n);
    env->ReleaseByteArrayElements(a, b, JNI_ABORT);

    if (on_c2s(v) == 0) return nullptr;

    jbyteArray o = env->NewByteArray((jsize)v.size());
    env->SetByteArrayRegion(o, 0, (jsize)v.size(), (const jbyte*)v.data());
    return o;
}

extern "C" JNIEXPORT jobjectArray JNICALL
Java_io_zdrx_client_Zdrx_drainOut(JNIEnv* env, jclass) {
    std::vector<std::vector<uint8_t>> q;
    if (drain_out(q) == 0) return nullptr;

    jclass ba = env->FindClass("[B");
    jobjectArray arr = env->NewObjectArray((jsize)q.size(), ba, nullptr);
    for (jsize i = 0; i < (jsize)q.size(); i++) {
        jbyteArray b = env->NewByteArray((jsize)q[i].size());
        env->SetByteArrayRegion(b, 0, (jsize)q[i].size(), (const jbyte*)q[i].data());
        env->SetObjectArrayElement(arr, i, b);
        env->DeleteLocalRef(b);
    }
    return arr;
}

extern "C" JNIEXPORT jint JNICALL
Java_io_zdrx_client_Zdrx_espInto(JNIEnv* env, jclass, jobject buf) {
    if (!buf) return 0;
    float* p = (float*)env->GetDirectBufferAddress(buf);
    if (!p) return 0;
    jlong cap = env->GetDirectBufferCapacity(buf);
    return (jint)drain_into(p, (int)cap);
}

extern "C" JNIEXPORT jboolean JNICALL
Java_io_zdrx_client_Zdrx_firing(JNIEnv*, jclass) {
    return firing() ? JNI_TRUE : JNI_FALSE;
}

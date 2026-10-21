#pragma once
#include <cstdint>
#include <string>

class ProvisioningSession {
public:
    static constexpr uint32_t durationMs = 5 * 60 * 1000;

    void begin(uint32_t now, const std::string &token) {
        token_ = token;
        started_ = now;
        active_ = token.size() == 32;
    }
    void end() { active_ = false; token_.clear(); }
    bool active(uint32_t now) const {
        return active_ && uint32_t(now - started_) < durationMs;
    }
    bool authorized(uint32_t now, const std::string &token) const {
        if (!active(now) || token.size() != token_.size()) return false;
        unsigned difference = 0;
        for (size_t i = 0; i < token.size(); ++i) difference |= token[i] ^ token_[i];
        return difference == 0;
    }
    template<class Save>
    int submit(uint32_t now, const std::string &token, const std::string &ssid,
               const std::string &password, Save save) {
        if (!authorized(now, token)) return 403;
        if (ssid.empty() || ssid.size() > 32 || ssid.find('\0') != std::string::npos ||
            password.size() < 8 || password.size() > 63 || password.find('\0') != std::string::npos) return 400;
        if (!save()) return 500;
        end();
        return 200;
    }
private:
    std::string token_;
    uint32_t started_ = 0;
    bool active_ = false;
};

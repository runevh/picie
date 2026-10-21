#pragma once
#include <memory>

// Keep the trust anchors alive for every connection that uses them.
template <typename SecureClient, typename TrustAnchors>
class TrustedConnection {
public:
    explicit TrustedConnection(SecureClient& client) : client_(client) {}

    bool configure(bool useTls, const char* certificate) {
        client_.stop();
        client_.setTrustAnchors(nullptr);
        anchors_.reset();
        if (!useTls || !certificate || !*certificate) return false;
        std::unique_ptr<TrustAnchors> anchors(new TrustAnchors(certificate));
        if (!anchors->getCount()) return false;
        anchors_ = std::move(anchors);
        client_.setTrustAnchors(anchors_.get());
        return true;
    }

    template <typename Authenticate>
    bool connect(const char* host, unsigned short port, Authenticate authenticate) {
        // The hostname overload performs TLS certificate and hostname verification.
        if (!anchors_ || !client_.connect(host, port)) {
            client_.stop();
            return false;
        }
        if (!authenticate()) {
            client_.stop();
            return false;
        }
        return true;
    }

private:
    SecureClient& client_;
    std::unique_ptr<TrustAnchors> anchors_;
};

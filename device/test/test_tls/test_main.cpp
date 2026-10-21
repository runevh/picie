#include <unity.h>
#include <network/trusted_connection.h>
#include <string>

// Isolate certificate parsing and the transport; the ESP8266 build uses BearSSL.
struct Anchors {
    explicit Anchors(const char* certificate) : count(std::string(certificate) == "valid-ca" ? 1 : 0) {}
    int getCount() const { return count; }
    int count;
};
struct Client {
    const Anchors* anchors = nullptr;
    bool handshakeOk = true;
    bool connected = false;
    int calls = 0;
    std::string hostname;
    void stop() { connected = false; }
    void setTrustAnchors(const Anchors* value) { anchors = value; }
    bool connect(const char* host, unsigned short) {
        calls++;
        hostname = host;
        connected = anchors && handshakeOk;
        return connected;
    }
};
void setUp() {}
void tearDown() {}
void missing_or_invalid_ca_blocks_connection() {
    for (const char* pem : {static_cast<const char*>(nullptr), "", "malformed"}) {
        Client client;
        TrustedConnection<Client, Anchors> connection(client);
        bool secretRead = false;
        TEST_ASSERT_FALSE(connection.configure(true, pem));
        TEST_ASSERT_FALSE(connection.connect("frame.example", 443, [&] { secretRead = true; return true; }));
        TEST_ASSERT_EQUAL(0, client.calls);
        TEST_ASSERT_FALSE(secretRead);
    }
}
void failed_handshake_never_sends_identity() {
    Client client;
    TrustedConnection<Client, Anchors> connection(client);
    TEST_ASSERT_TRUE(connection.configure(true, "valid-ca"));
    client.handshakeOk = false;
    bool sent = false;
    TEST_ASSERT_FALSE(connection.connect("frame.example", 443, [&] { sent = true; return true; }));
    TEST_ASSERT_FALSE(sent);
    TEST_ASSERT_FALSE(client.connected);
    TEST_ASSERT_EQUAL_STRING("frame.example", client.hostname.c_str());
}
void verified_connection_authenticates_and_rejects_failed_auth() {
    Client client;
    TrustedConnection<Client, Anchors> connection(client);
    connection.configure(true, "valid-ca");
    int sent = 0;
    TEST_ASSERT_TRUE(connection.connect("frame.example", 443, [&] { sent++; return true; }));
    TEST_ASSERT_EQUAL(1, sent);
    TEST_ASSERT_FALSE(connection.connect("frame.example", 443, [] { return false; }));
    TEST_ASSERT_FALSE(client.connected);
}
void invalid_reconfiguration_discards_previous_trust() {
    Client client;
    TrustedConnection<Client, Anchors> connection(client);
    connection.configure(true, "valid-ca");
    TEST_ASSERT_TRUE(connection.connect("frame.example", 443, [] { return true; }));
    TEST_ASSERT_FALSE(connection.configure(true, "malformed"));
    TEST_ASSERT_NULL(client.anchors);
    TEST_ASSERT_FALSE(client.connected);
    TEST_ASSERT_FALSE(connection.connect("frame.example", 443, [] { return true; }));
    TEST_ASSERT_FALSE(connection.configure(false, "valid-ca"));
    TEST_ASSERT_FALSE(connection.connect("frame.example", 443, [] { return true; }));
}
int main() {
    UNITY_BEGIN();
    RUN_TEST(missing_or_invalid_ca_blocks_connection);
    RUN_TEST(failed_handshake_never_sends_identity);
    RUN_TEST(verified_connection_authenticates_and_rejects_failed_auth);
    RUN_TEST(invalid_reconfiguration_discards_previous_trust);
    return UNITY_END();
}

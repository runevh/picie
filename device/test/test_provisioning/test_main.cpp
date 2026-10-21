#include <unity.h>
#include <network/provisioning_session.h>
#include <limits>

const std::string code(32, 'a');
void setUp() {}
void tearDown() {}

void unauthorized_requests_cannot_save_or_complete() {
    ProvisioningSession session;
    int writes = 0;
    auto save = [&]() { ++writes; return true; };
    TEST_ASSERT_EQUAL(403, session.submit(0, code, "Home", "password", save));
    session.begin(10, code);
    for (const auto &token : {std::string(), std::string(32, 'b'), code + "x"}) {
        TEST_ASSERT_EQUAL(403, session.submit(20, token, "Home", "password", save));
    }
    TEST_ASSERT_EQUAL(0, writes);
    TEST_ASSERT_TRUE(session.active(20));
}
void expiry_is_absolute_and_wrap_safe() {
    ProvisioningSession session;
    const uint32_t start = std::numeric_limits<uint32_t>::max() - 100;
    session.begin(start, code);
    TEST_ASSERT_TRUE(session.authorized(start + 200, code));
    TEST_ASSERT_TRUE(session.authorized(start + ProvisioningSession::durationMs - 1, code));
    int writes = 0;
    TEST_ASSERT_EQUAL(403, session.submit(start + ProvisioningSession::durationMs, code,
        "Home", "password", [&]() { ++writes; return true; }));
    TEST_ASSERT_EQUAL(0, writes);
}
void invalid_credentials_do_not_save() {
    ProvisioningSession session;
    session.begin(0, code);
    int writes = 0;
    auto save = [&]() { ++writes; return true; };
    for (const auto &ssid : {std::string(), std::string(33, 's'), std::string("a\0b", 3)})
        TEST_ASSERT_EQUAL(400, session.submit(1, code, ssid, "password", save));
    for (const auto &password : {std::string(), std::string(7, 'p'), std::string(64, 'p'), std::string("password\0x", 10)})
        TEST_ASSERT_EQUAL(400, session.submit(1, code, "Home", password, save));
    TEST_ASSERT_EQUAL(0, writes);
}
void failed_save_can_retry_but_success_is_single_use() {
    ProvisioningSession session;
    session.begin(0, code);
    TEST_ASSERT_EQUAL(500, session.submit(1, code, " Home ", "password", []() { return false; }));
    TEST_ASSERT_TRUE(session.active(1));
    int writes = 0;
    auto save = [&]() { ++writes; return true; };
    TEST_ASSERT_EQUAL(200, session.submit(2, code, " Home ", "password", save));
    TEST_ASSERT_FALSE(session.active(2));
    TEST_ASSERT_EQUAL(403, session.submit(3, code, "Home", "password", save));
    TEST_ASSERT_EQUAL(1, writes);
    session.begin(4, std::string(32, 'b'));
    TEST_ASSERT_FALSE(session.authorized(5, code));
    TEST_ASSERT_TRUE(session.authorized(5, std::string(32, 'b')));
    session.end();
    TEST_ASSERT_FALSE(session.active(5));
}
void missing_secret_cannot_enable_setup() {
    ProvisioningSession session;
    session.begin(0, "");
    TEST_ASSERT_FALSE(session.active(0));
}
int main() {
    UNITY_BEGIN();
    RUN_TEST(unauthorized_requests_cannot_save_or_complete);
    RUN_TEST(expiry_is_absolute_and_wrap_safe);
    RUN_TEST(invalid_credentials_do_not_save);
    RUN_TEST(failed_save_can_retry_but_success_is_single_use);
    RUN_TEST(missing_secret_cannot_enable_setup);
    return UNITY_END();
}

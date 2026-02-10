#if __has_include("generated_root_ca.h")
#include "generated_root_ca.h"
#else
static const char *const ROOT_CA_CERT_PEM = "";
#endif

#include "app_config.h"

const AppConfig kDefaultAppConfig = {
    {"picie.runevh.net", 7736},
    {1000UL, 120000UL, 2.0f}, // exponential backoff capped at 2 minutes
    10UL,
    true,
    ROOT_CA_CERT_PEM
};

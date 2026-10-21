# Login attempt limits

Login attempts are limited for five minutes: 10 per login identifier/account and
60 per TCP peer. Username and email share the account budget. Forwarded headers
are deliberately ignored; clients behind the same proxy share the peer budget.
Budgets are process-local and reset on restart. Multiple backend replicas would
need a shared store and a deliberately configured trusted-proxy policy.

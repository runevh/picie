#### Setting up the project

Create a `.env` file with following variables:

* `POSTGRES_USER`
* `POSTGRES_PASSWORD`
* `POSTGRES_DB`
* `JWT_SECRET`

#### Running development

```
sudo sudo docker-compose -f docker-compose.dev.yml up --build
```

#### Running tests

```
sudo docker compose -f 'docker-compose.dev.yml' up --build 'test'
```

#### Provisioning an administrator

Public registration always creates a regular account. Register your account,
then run this command from the repository root on the deployment server:

```sh
docker compose -f docker-compose.prod.yml exec backend npm run admin:promote -- user@example.com
```

Use the account's exact registered email address. This requires operator access
to the server and database; there is no public administrator setup endpoint.
The command promotes an existing account, can be repeated safely, and exits
with an error if the account does not exist. It does not reset passwords or
change other accounts. Existing administrators remain administrators.

For a backend running outside Compose, run `npm run admin:promote -- user@example.com`
from `backend` with `POSTGRES_NAME`, `POSTGRES_USER`, and `POSTGRES_PASSWORD`
configured. `POSTGRES_HOST` defaults to `db` and can be overridden for that command.

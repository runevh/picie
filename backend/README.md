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

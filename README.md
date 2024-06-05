 Instructions for installing ThanksPedia tBC
========================================================================
This is a step-by-step guide to install Thankspedia tBC also known as `libtbc`.

## 1. Setting up github.com

First, please make sure that you are a collaborator in the following projects

* [Main body = libtbc integrated version of tBC (Thankspedia)](https://github.com/thankspedia/libtbc/)
* [Framework section（Apupu Framework)](https://github.com/thankspedia/)

## 2. Clone the Repository and Initialize its Sub Modules

Initialize the repository by executing following steps.

```sh
git clone git@github.com:thankspedia/libtbc.git libtbc
```

```sh
cd ./libtbc/
```

```sh
git submodule update --init --recursive
```

```sh
cd ./database-postgresql-context/.
npm install
cd ..
```

```sh
cd ./database-postgresql-query-builder/
npm install
cd ..
```

```sh
cd ./asynchronous-context/
sudo npm remove asynchronous-context -g
sudo npm link
cd ..
```

```sh
cd ./asynchronous-context-rpc/
npm install
sudo npm remove asynchronous-context-rpc -g
sudo npm link
cd ..
```

```sh
cd ./crypto-web-token/
npm install
sudo npm remove crypto-web-token -g
sudo npm link
cd ..
```

## 3. Place a configuration file in the repository

Create three symlinks to configuration files.

### 1  ./apptbc/.env

Go to `./apptbc/` and set up the startup conditions for apptbc. That is a Create-React-App app for the frontend system.

```sh
cd ./apptbc/
```

The directory `./apptbc/configs/` is the directory to store preexisting configuration files. Create a symbolic link to it in the `./apptbc/` directory.

If the configuration file for the server to be started is already in `./apptbc/configs/` directory, simply use it.

If it does not already exist, create it in `./apptbc/configs/` directory.

This file contains the setting that pointing the URL to the API server that the frontend application should access.

```sh
ln -s configs/localhost.env .env
```

`./libtbc/` directory.

```sh
cd ..
```

### 3. ./runtbc/.settings.json

Go to `./runtbc/` directory. This directory contains backend startup. Change the current directory to there to set up the startup conditions.

```sh
cd ./runtbc/
```

`./runtbc/configs/` directory contains the configuration files. Create a symbolic link to it in the `.` `/runtbc/` directory.

If there is already a configuration file for the server to be started, create a symbolic link to it in the `.` `/runtbc/configs/` directory.

If it does not already exist, create it in `./runtbc/configs/` directory.

There should be several configuration files which are named as `[config-name].settings.json`.

These files are configuration files which you can specify database settings, and the username and password of the superuser, the password for web-tokens and so on.

```sh
ln -s configs/schizostylis.settings.json .settings.json
```

When you have done the setting, go to `./libtbc/` directory.

```sh
cd ..
```

## Install Database

If you already have a database system installed , you do not have to follow these steps.

### Install PostgreSQL 15

<https://www.postgresql.org/download/linux/ubuntu/>

```sh
# Create the file repository configuration:
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'

# Import the repository signing key:
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -

# Update the package lists:
sudo apt update

# Install the latest version of PostgreSQL.
# If you want a specific version, use 'postgresql-12' or similar instead of 'postgresql':
sudo apt install postgresql-15 
sudo systemctl status postgresql 
```

### Allow external connections to PostgreSQL server instance.

1. Make sure that the server (EC2 instance/virtual machine/real server) allows external access to port 5432.
2. Change the configuration of PostgreSQL.
```sh
# display the path of config file.
sudo -u postgres psql -c "SHOW config_file;"
```
3. Update postgresql.conf.
```sh
sudo vi /etc/postgresql/14/main/postgresql.conf
```

```sh
#listen_addresses = 'localhost'
listen_addresses = '*'
```

4. Change `pg_hba.conf`.

```sh
sudo vi /etc/postgresql/14/main/pg_hba.conf 
```

```sh
# TYPE  DATABASE	USER	ADDRESS   	METHOD
host    all             all             0.0.0.0/0             scram-sha-256 # ADDED 2022/04/07 15:16:23
host    all             all             ::0/0                 scram-sha-256 # ADDED 2022/04/07 15:16:26
```

5. Restart the service.

```sh
sudo systemctl restart postgresql
```

### Install `pgAdmin4`.

If you do not need to use pgAdmin4 for operation, skip this step.

Note that as of July 2023, the Linux ARM processor version of deb is not provided and cannot be installed.

Refer to the following site: https: [//www.pgadmin.org/download/pgadmin-4-apt/](https://www.pgadmin.org/download/pgadmin-4-apt/)

Install pgAdmin according to the following procedure.

```sh
# Install the public key for the repository (if not done previously):
curl -fsS https://www.pgadmin.org/static/packages_pgadmin_org.pub | sudo gpg --dearmor -o /usr/share/keyrings/packages-pgadmin-org.gpg

# Create the repository configuration file:
sudo sh -c 'echo "deb [signed-by=/usr/share/keyrings/packages-pgadmin-org.gpg] https://ftp.postgresql.org/pub/pgadmin/pgadmin4/apt/$(lsb_release -cs) pgadmin4 main" > /etc/apt/sources.list.d/pgadmin4.list && apt update'

# Install for both desktop and web modes:
sudo apt install pgadmin4

```

## Create a Database
If the database has already been created, this step is not necessary.

### Create username and password.

Create an arbitrary user name as the user name. This user name should be something descriptive, such as the name of your project.

```sh
USERNAME="ttc2023"
```

For the password, use the following command to create a secure password.

```sh
PASSWORD=$(head -c 32 /dev/random | base64url)
```

Display the password using the following command.

```sh
echo "$PASSWORD"
```

The database creator must manage the created password so that it is not forgotten.

Reference: https: [//security.stackexchange.com/questions/3936/is-a-rand-from-dev-urandom-secure-for-a-login-keyhttps://www.2uo.](https://www.2uo.de/myths-about-urandom/) about-urandom [de/myths-about-urandom/reference](https://www.2uo.de/myths-about-urandom/): [about-environment-variableshttps://stackoverflow.com/questions/18725880/using-an-environment-variable-in-a-psql-script](https://stackoverflow.com/questions/18725880/using-an-environment-variable-in-a-psql-script)

Use the following command to determine the name of the database.

```sh
DATABASENAME="${USERNAME}db"
```

Use the following command to determine the name of the schema.

```sh
SCHEMANAME="${USERNAME}"
```

### Create username/database/schema.

```sh
sudo -u postgres psql --set=password="$PASSWORD" --set=username="$USERNAME" --set=databasename="$DATABASENAME" --set=schemaname="$SCHEMANAME"
CREATE USER :username  WITH PASSWORD :'password';
CREATE DATABASE :databasename;
GRANT ALL PRIVILEGES ON DATABASE :databasename TO :username;
\c :username;
CREATE SCHEMA :schemaname;
GRANT ALL ON SCHEMA :schemaname TO :username;
GRANT ALL ON ALL TABLES IN SCHEMA :schemaname TO :username;

ubuntu=> \q
```

## Initialize the Database for `libtbc`

Initialize Database for `libtbc` system:w
.

`./coretbc/` directory.

```sh
cd ./coretbc/
```

Create a link to the runtbc (backend startup script) configuration file. This is
to run coretbc under the same conditions as the current backend startup script.

```sh
ln -s ../runtbc/.env .env
ln -s ../runtbc/.settings.json .settings.json
```

Run the DB initialization script.

```sh
 node bin/recreate-database.js
```

`.` Return to the `/libtbc/` directory .

```sh
cd ..
```

## Proxying by Nginx

**TODO**

```nginx
server {
    root /var/www/html;
    server_name ttc2023.tbc-net.com;

    listen [::]:443 ssl ipv6only=on; # managed by Certbot
    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/ttc2023.tbc-net.com/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/ttc2023.tbc-net.com/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot
    # <<< ADDED Tue, 23 Jan 2024 17:56:20 +0900
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "Upgrade";
    # >>> ADDED Tue, 23 Jan 2024 17:56:20 +0900

    location /api/ {
        proxy_pass http://127.0.0.1:2000/api/;
    }
    location /foo {
        proxy_pass http://127.0.0.1:3593/foo;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }

    location / {
        proxy_pass http://127.0.0.1:3000/;
    }
    location /endpoint-for-slackbot/ {
        proxy_pass http://127.0.0.1:3002/api/;
    }
}

server {
    if ($host = ttc2023.tbc-net.com) {
        return 301 https://$host$request_uri;
    } # managed by Certbot


    listen 80 default_server;
    listen [::]:80 default_server;
    server_name ttc2023.tbc-net.com;
    return 404; # managed by Certbot
}
```

### Configuration for WebSocket Server ###

TODO

[Nginx Configuration](https://www.nginx.com/blog/websocket-nginx/)

[Vite : HMR Does'nt Work Properly](https://github.com/vitejs/vite/discussions/6473)

[Restarging Nginx](https://www.cyberciti.biz/faq/nginx-restart-ubuntu-linux-command/)


## libtbc startup

During development, libtbc is configured to run on tmux for ease of development.

In production, it would be preferable to run libtbc as a daemon process, but this is not implemented yet.

TODO: it should be a better approach than this. The following article should
help to improve.

Reference: [https://devops.stackexchange.com/a/11690](https://devops.stackexchange.com/a/11690) There *is nothing wrong
with using tmux/xscreen to start the server, but it is generally not considered
a good practice. Generally, daemontools / supervisor, etc. are used to run the
system.*

### Launch `libtbc` on tmux

Start tmux and split the current window horizontally.

```sh
tmux attach
tmux split-window -h

```

Go to the runtbc directory and start it.

```sh
cd ./runtbc/
npm start
```

Go to the opposite pane of the split.

```sh
tmux select-pane -l
```

Go to the apptbc directory and start the front end.

```sh
cd ./apptbc/
npm start
```

## Log in to libtbc as administrator

Open the launched front-end application in your browser. [http://localhost:3000/login\*](http://localhost:3000/login) The host name depends on the environment where the server was created.

Log in with username / password specified in .settings.json

## Loading test data

Open the launched front-end application in your browser: http: [//localhost:3000/users\*](http://localhost:3000/users) The host name depends on the environment where the server was created.

Look at the buttons in the upper left corner.

![](img/upload-download.png)

You can call file upload by pressing the ↑ button in this .

`./runtbc/doc/` directory contains test data.

The file `libtbc-ttc-v20230330.json` is the latest test data currently available.

# How to update the `libtbc` repository to the latest state

During the tBC update, there is a possibility that the frontend may experience some problems.

The cause is that the version of the front-end internal data does not match the version of the front-end React program.

When updating tBC, care should be taken not to waste time unnecessarily by pursuing the cause of the problem.

## 1. Update the repository.

```sh
git pull
```

## 2. Update the sub-repository.

```sh
git submodule update --init --recursive --remote
```

## 3. Update database tables.

Update intl data to the latest.

```sh
cd libtbc/coretbc
bin/recreate-intl.js
```

If the data on the database is not critical, rebuilding the database will certainly prevent problems.

```sh
cd libtbc/coretbc
bin/recreate-database.js
```

## 4. reset the front-end internal data.

Access `/reset-all` to reset front-end internal data.

```sh
 http(s)://[host-name/reset-all
```

This should fix the problem on the front end.

If you still encounter unknown problems, please investigate and add them to this section.

# Conclusion

TODO : There are still remaining issues.

- Fixing the bot not being able to be activated at this time.
- Others.


#!/usr/bin/env bash

PATH="$PATH:/home/lucas/.bun/bin"

NAME="privatehub-media"
TMPDIR="/tmp/$NAME"
WORKDIR="/var/www/$NAME"
SERVICE="${NAME}.service"

[ -e $TMPDIR ] && rm -rf $TMPDIR
[ -e $WORKDIR ] && cp -af $WORKDIR $TMPDIR
cd $TMPDIR || exit 1

git clean -fxd -e .env
cp .env .env.production

npm install
#bun run location
#bun run build || exit 1

# Para o serviço
sudo /usr/bin/systemctl stop $SERVICE

# Copia novo build
[ -e $WORKDIR ] && rm -rf $WORKDIR
[ -e $TMPDIR ] && cp -af $TMPDIR $WORKDIR || exit 1

# Inicia serviço
sudo /usr/bin/systemctl start $SERVICE

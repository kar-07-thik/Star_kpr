FROM node:24-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install --omit=dev --no-fund --no-audit

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
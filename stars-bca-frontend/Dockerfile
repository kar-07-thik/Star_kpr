FROM node:24-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install --no-fund --no-audit

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
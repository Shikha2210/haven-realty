# One image: builds the React app, embeds it in the Spring Boot jar, runs it on JRE 21.
FROM node:22-alpine AS web
WORKDIR /web
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM maven:3.9-eclipse-temurin-21 AS api
WORKDIR /api
COPY backend/pom.xml ./
RUN mvn -B -q dependency:go-offline
COPY backend/src ./src
COPY --from=web /web/dist ./src/main/resources/static
RUN mvn -B -q -DskipTests package && cp target/*.jar /app.jar

FROM eclipse-temurin:21-jre
RUN useradd -m app && mkdir /data && chown app /data
USER app
ENV STORAGE_DIR=/data/storage DEV_EXPOSE_OTP=false SPRING_PROFILES_ACTIVE=mysql
COPY --from=api /app.jar /app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app.jar"]

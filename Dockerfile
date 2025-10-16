# Use an official OpenJDK 17 runtime as a parent image.
# Using a "slim" version for a smaller image size.
FROM openjdk:17-jdk-slim

# Set the working directory inside the container
WORKDIR /app

# Copy the Maven wrapper files and the pom.xml file
# These are needed to download dependencies and build the project
COPY .mvn/ .mvn
COPY mvnw pom.xml ./

# Download all dependencies. This is done as a separate step
# to take advantage of Docker's layer caching. If our code changes
# but the dependencies don't, this step will be skipped, speeding up builds.
RUN ./mvnw dependency:go-offline

# Copy the rest of your application's source code
COPY src ./src

# Package the application into a .jar file using Maven.
# We skip running tests during this build process.
RUN ./mvnw package -DskipTests

# The application will run on port 8080, so we need to expose it
EXPOSE 8080

# This is the command that will be executed when the container starts.
# It runs your compiled Java application.
ENTRYPOINT ["java", "-jar", "target/demo-0.0.1-SNAPSHOT.jar"]

# Use the official .NET 8 SDK image for building
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy the project file and restore dependencies
COPY ["Hotel_System.API.csproj", "./"]
RUN dotnet restore "Hotel_System.API.csproj"

# Copy the rest of the source code
COPY . .

# Build and publish the application
RUN dotnet publish "Hotel_System.API.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Use the official .NET 8 ASP.NET runtime image
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=build /app/publish .

# Expose port 8080 (default for .NET 8)
EXPOSE 8080
ENV ASPNETCORE_HTTP_PORTS=8080

ENTRYPOINT ["dotnet", "Hotel_System.API.dll"]

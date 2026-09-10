FROM php:8.2-apache

# Install PHP extensions and enable Apache modules
RUN apt-get update && apt-get install -y \
    libpng-dev libjpeg-dev libfreetype6-dev \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install pdo_mysql mysqli \
    && a2enmod rewrite \
    && sed -i 's/AllowOverride None/AllowOverride All/g' /etc/apache2/apache2.conf \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js for building frontend
RUN apt-get update && apt-get install -y curl \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy project files
COPY . .

# Set build-time env vars
ENV VITE_BASE_PATH=/

# Inject DB credentials into config.example.php before build
RUN sed -i "s/getenv('DB_HOST') ?: '127.0.0.1'/getenv('DB_HOST') ?: 'bbc8avr3tqz5zevjzzca-mysql.services.clever-cloud.com'/" api/config.example.php && \
    sed -i "s/getenv('DB_NAME') ?: 'estate'/getenv('DB_NAME') ?: 'bbc8avr3tqz5zevjzzca'/" api/config.example.php && \
    sed -i "s/getenv('DB_USER') ?: 'root'/getenv('DB_USER') ?: 'uklx2tvaezfez2en'/" api/config.example.php && \
    sed -i "s/getenv('DB_PASS') ?: ''/getenv('DB_PASS') ?: 'u0ujvDfRgOpRvlkst4v4'/" api/config.example.php && \
    sed -i "s|getenv('APP_ENV') ?: 'development'|getenv('APP_ENV') ?: 'production'|" api/config.example.php && \
    sed -i "s|http://localhost/rent-smart-tz|https://rent-smart-tz.onrender.com|" api/config.example.php

# Build frontend
RUN npm install && npm run deploy

# Copy built files to Apache document root
RUN cp -r deploy/* /var/www/html/ \
    && rm -rf /var/www/html/deploy

# Set permissions
RUN chown -R www-data:www-data /var/www/html \
    && chmod -R 755 /var/www/html

EXPOSE 80

FROM ruby:3.2.2-slim

RUN apt-get update -qq && apt-get install -y \
    build-essential \
    libpq-dev \
    curl \
    git \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Gemfile 먼저 복사 → bundle install (레이어 캐시 활용)
COPY Gemfile ./
RUN bundle install --jobs 4 --retry 3

# 나머지 파일 복사
COPY . .

# 실행 권한 부여
RUN chmod +x bin/rails bin/rake bin/bundle docker-entrypoint.sh \
    && mkdir -p tmp/pids log

EXPOSE 3000
CMD ["./docker-entrypoint.sh"]

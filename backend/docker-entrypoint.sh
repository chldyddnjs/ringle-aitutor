#!/bin/bash
set -e

# 이전 서버 pid 제거
rm -f tmp/pids/server.pid

echo "⏳ PostgreSQL 연결 대기 중..."
until bundle exec rails runner "ActiveRecord::Base.connection.execute('SELECT 1')" 2>/dev/null; do
  echo "   재시도 중... (2초 후)"
  sleep 2
done
echo "✅ PostgreSQL 연결 성공"

echo "🔄 DB 마이그레이션 실행..."
bundle exec rails db:create 2>/dev/null || true
bundle exec rails db:migrate

USER_COUNT=$(bundle exec rails runner "print User.count" 2>/dev/null || echo "0")
if [ "$USER_COUNT" = "0" ]; then
  echo "🌱 시드 데이터 입력 중..."
  bundle exec rails db:seed
fi

echo "🚀 Rails 서버 시작 (0.0.0.0:3000)..."
exec bundle exec rails server -b 0.0.0.0 -p 3000

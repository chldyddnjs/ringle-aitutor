# .env 파일 수동 로드 (dotenv gem 없이)
env_file = Rails.root.join(".env")
if File.exist?(env_file)
  File.readlines(env_file).each do |line|
    line = line.strip
    next if line.empty? || line.start_with?("#")
    key, value = line.split("=", 2)
    next unless key && value
    ENV[key] ||= value.strip
  end
end

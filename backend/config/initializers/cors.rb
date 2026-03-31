Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins do |source, _env|
      if Rails.env.development?
        source =~ /\Ahttp:\/\/localhost(:\d+)?\z/
      else
        ENV.fetch("CORS_ORIGINS", "").split(",").map(&:strip).include?(source)
      end
    end

    resource "*",
      headers: :any,
      methods: [:get, :post, :put, :patch, :delete, :options, :head],
      expose: ["Content-Type"],
      credentials: false
  end
end

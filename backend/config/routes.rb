Rails.application.routes.draw do
  get "up" => "rails/health#show", as: :rails_health_check

  # 데모용: 인증 없이 유저 목록 (실서비스에서 제거)
  get "users/demo", to: "users#demo"

  # 공개
  resources :membership_plans, only: [:index]

  # 유저
  resources :memberships, only: [:index] do
    collection { get :active }
  end
  resources :payments, only: [:create]

  # AI (멤버십 conversation 기능 필요)
  post '/ai/chat', to: 'ai#chat'
  post '/ai/stt',  to: 'ai#stt'
  post '/ai/tts',  to: 'ai#tts'

  # 어드민
  namespace :admin do
    resources :memberships, only: [:index, :create, :destroy]
    resources :users,       only: [:index, :show]
  end
end

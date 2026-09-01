from django.urls import path

from .views import CsrfView, CurrentUserView, LoginView, LogoutView

urlpatterns = [
    path("csrf", CsrfView.as_view()),
    path("login", LoginView.as_view()),
    path("logout", LogoutView.as_view()),
    path("me", CurrentUserView.as_view()),
]

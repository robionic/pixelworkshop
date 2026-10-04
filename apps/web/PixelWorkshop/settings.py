from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
REPOSITORY_ROOT = BASE_DIR.parent.parent

SECRET_KEY = 'django-in-browser-image-editor-development-key'
DEBUG = True
ALLOWED_HOSTS = []

INSTALLED_APPS = [
    'django.contrib.staticfiles',
    'editor',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
]

ROOT_URLCONF = 'PixelWorkshop.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [],
        },
    },
]

WSGI_APPLICATION = 'PixelWorkshop.wsgi.application'

STATIC_URL = 'static/'
STATICFILES_DIRS = [REPOSITORY_ROOT / 'shared' / 'images']
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

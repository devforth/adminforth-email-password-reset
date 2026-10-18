<template>
  <div class="relative flex items-center justify-center min-h-screen bg-lightHtml dark:bg-darkHtml w-screen h-screen"
    :style="coreStore.config?.loginBackgroundImage && backgroundPosition === 'over' ? {
      'background-image': 'url(' + loadFile(coreStore.config?.loginBackgroundImage) + ')',
      'background-size': 'cover',
      'background-position': 'center',
      'background-blend-mode': coreStore.config?.removeBackgroundBlendMode ? 'normal' : 'darken'
    }: {}"
  >

    <img v-if="coreStore.config?.loginBackgroundImage && backgroundPosition !== 'over'"
      :src="loadFile(coreStore.config?.loginBackgroundImage)"
      class="position-absolute top-0 left-0 h-screen object-cover w-0"
      :class="{
        '1/2': 'md:w-1/2',
        '1/3': 'md:w-1/3',
        '2/3': 'md:w-2/3',
        '3/4': 'md:w-3/4',
        '2/5': 'md:w-2/5',
        '3/5': 'md:w-3/5',
      }[backgroundPosition]"
    />

    <!-- Main modal -->
    <div id="authentication-modal" tabindex="-1"
      class="af-reset-password-modal overflow-y-auto flex flex-grow
      overflow-x-hidden z-50 min-w-[350px]  justify-center items-center md:inset-0 h-[calc(100%-1rem)] max-h-full">
      <div class="relative flex w-full max-h-full justify-center p-4">
        <DialogPanel
          class="af-login-popup af-auth-card"
          :title="header.title"
          :subtitle="header.subtitle"
          :error="validationError || error"
          :classes="AUTH_CARD_CLASSES"
        >
          <template #icon>
            <IconMail v-if="requestSent" />
            <IconLock v-else />
          </template>
          <template v-if="route.meta.pageInjection?.panelHeader" #title>
            <component :is="getCustomComponent({file: route.meta.pageInjection?.panelHeader})" />
          </template>

          <template v-if="enteringNew">
            <!-- enter is handled on the wrapper: Input spreads attrs on both its root and the input -->
            <div class="af-password-field" @keydown.enter="passwordConfirmationInput!.focus()">
              <label for="password" class="block mb-2 text-sm font-medium text-lightLoginViewTextColor dark:text-darkLoginViewTextColor">{{ $t('New password') }}</label>
              <Input
                v-model="password"
                id="password"
                name="password"
                type="password"
                passwordToggle
                autocomplete="new-password"
                :placeholder="$t('New password')"
                :invalid="Boolean(validationError)"
                fullWidth
                required
              />
            </div>
            <div class="af-password-field" @keydown.enter="setNewPassword">
              <label for="password_confirmation" class="block mb-2 text-sm font-medium text-lightLoginViewTextColor dark:text-darkLoginViewTextColor">{{ $t('Confirm new password') }}</label>
              <Input
                ref="passwordConfirmationInput"
                v-model="passwordConfirmation"
                id="password_confirmation"
                name="password_confirmation"
                type="password"
                passwordToggle
                autocomplete="new-password"
                :placeholder="$t('Confirm new password')"
                :invalid="Boolean(validationError)"
                fullWidth
                required
              />
            </div>
          </template>

          <p v-else-if="requestSent" role="status" class="af-alert-success flex items-start gap-2.5 rounded-lg border border-lightSuccessBorder bg-lightSuccessSoft px-3.5 py-3 text-sm leading-5 text-lightSuccess dark:border-darkSuccessBorder dark:bg-darkSuccessSoft dark:text-darkSuccess">
            <IconCircleCheck class="w-5 h-5 shrink-0" />
            {{ $t('If an account with {email} exists, we sent it a link to reset the password.', { email: sentToEmail }) }}
          </p>

          <div v-else @keydown.enter="reset()">
            <label for="email" class="block mb-2 text-sm font-medium text-lightLoginViewTextColor dark:text-darkLoginViewTextColor">{{ $t('Your email') }}</label>
            <Input
              v-model="emailInput"
              id="email"
              name="email"
              type="email"
              autocomplete="email"
              placeholder="name@company.com"
              fullWidth
              required
            />
            <component
              v-if="route.meta.pageInjection?.underInputs"
              :is="getCustomComponent({file: route.meta.pageInjection?.underInputs})"
            />
          </div>

          <template #footer>
            <Button
              v-if="enteringNew"
              :loader="inProgress"
              :disabled="inProgress || (validationRunning && validationError)"
              class="whitespace-nowrap"
              @click="setNewPassword"
            >
              {{ $t('Set new password') }}
            </Button>
            <template v-else>
              <LinkButton to="/login" variant="secondary" class="whitespace-nowrap">{{ $t('Back to login') }}</LinkButton>
              <Button v-if="!requestSent" :loader="inProgress" :disabled="inProgress" class="whitespace-nowrap" @click="reset">
                {{ $t('Send reset link') }}
              </Button>
            </template>
          </template>
        </DialogPanel>
      </div>
    </div>

  </div>
</template>


<script setup lang="ts">

import { onMounted, ref, computed, Ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useCoreStore } from '@/stores/core';
import { callAdminForthApi, loadFile, applyRegexValidation } from '@/utils';
import { useRoute, useRouter } from 'vue-router';
import { IconCircleCheck, IconLock, IconMail } from '@iconify-prerendered/vue-lucide';
import { Button, DialogPanel, Input, LinkButton } from '@/afcl';
import adminforth from '@/adminforth';
import { getCustomComponent } from '@/utils';

const { t } = useI18n();

const inProgress = ref(false);

const coreStore = useCoreStore();
const requestSent = ref(false);

const emailInput = ref(null);
// class names apps restyle the card by, kept from the former AuthCard
const AUTH_CARD_CLASSES = {
  header: 'af-auth-card-header',
  icon: 'af-auth-card-icon',
  titleWrap: 'af-auth-card-title-wrap',
  title: 'af-auth-card-title',
  subtitle: 'af-auth-card-subtitle',
  body: 'af-auth-card-body',
  error: 'af-auth-card-error',
  footer: 'af-auth-card-footer',
};
const passwordConfirmationInput = ref<InstanceType<typeof Input> | null>(null);
const password = ref("");
const passwordConfirmation = ref("");
const sentToEmail: Ref<string> = ref('');

const route = useRoute();
const router = useRouter();

function checkPassowrd() {

  if (!password.value || !passwordConfirmation.value) {
    return 'Please enter both password and password confirmation';
  }
  if (password.value !== passwordConfirmation.value) {
    return 'Passwords do not match';
  }

  if (password.value.length < passwordField.value.minLength) {
    return `Password must be at least ${passwordField.value.minLength} characters long`;
  }

  if (password.value.length > passwordField.value.maxLength) {
    return `Password must be at most ${passwordField.value.maxLength} characters long`;
  }

  if (passwordField.value.validation) {
    const valError = applyRegexValidation(password.value, passwordField.value.validation);
    if (valError) {
      return valError;
    }
  }

  return null;
}


const validationRunning = ref(false);

const validationError = computed(() => {
  if (validationRunning.value) {
    return checkPassowrd();
  }
  return null;
});

const error = ref(null);

// if token query param is present, we are entering new password
const enteringNew = computed(() => route.query.token);

const header = computed(() => {
  const brand = coreStore.config?.brandName;
  if (enteringNew.value) {
    return { title: t('Set a new password'), subtitle: t('Choose a new password for your {brand} account', { brand }) };
  }
  if (requestSent.value) {
    return { title: t('Check your email'), subtitle: t('The reset link is on its way') };
  }
  return { title: t('Reset your password'), subtitle: t('Enter the email of your {brand} account', { brand }) };
});

const backgroundPosition = computed(() => {
  return coreStore.config?.loginBackgroundPosition || '1/2';
});

const passwordField = computed(
  () => route.meta.passwordField
)

onMounted(async () => {
  await coreStore.getPublicConfig();
});

async function reset() {
  error.value = null;
  const email = emailInput.value;
  if (!email) {
    error.value = 'Please enter your email';
    return;
  }

  inProgress.value = true;
  const resp = await callAdminForthApi({
    path: `/plugin/${route.meta.pluginInstanceId}/reset-password`,
    method: 'POST',
    body: {
      email,
      url: window.location.origin + window.location.pathname,
    }
  });
  inProgress.value = false;
  if (resp.error) {
    error.value = resp.error;
  } else {
    error.value = null;
    requestSent.value = true;
    sentToEmail.value = email;
  }
}

async function setNewPassword() {
  error.value = null;

  if (checkPassowrd()) {
    validationRunning.value = true;
    return;
  }

  inProgress.value = true;
  const resp = await callAdminForthApi({
    path: `/plugin/${route.meta.pluginInstanceId}/reset-password-confirm`,
    method: 'POST',
    body: {
      token: route.query.token,
      password: password.value,
    }
  });
  inProgress.value = false;
  if (resp.error) {
    error.value = resp.error;
  } else {
    error.value = null;
    router.push('/login');
    adminforth.alert({
      message: 'Password reset successfully. Please login with your new password',
      variant: 'success',
      timeout: 15,
    });

  }
}

</script>

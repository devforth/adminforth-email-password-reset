<template>
  <div class="relative flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-800 relative w-screen h-screen"
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
        <AuthCard
          class="af-login-popup"
          :title="header.title"
          :subtitle="header.subtitle"
          :error="validationError || error"
        >
          <template #icon>
            <IconEnvelopeOutline v-if="requestSent" class="w-6 h-6" />
            <IconLockOutline v-else class="w-6 h-6" />
          </template>
          <template v-if="route.meta.pageInjection?.panelHeader" #title>
            <component :is="getCustomComponent({file: route.meta.pageInjection?.panelHeader})" />
          </template>

          <template v-if="enteringNew">
            <PasswordField
              v-model="password"
              id="password"
              :label="$t('New password')"
              :placeholder="$t('New password')"
              :unmasked="unmasked"
              :invalid="Boolean(validationError)"
              @toggle="unmasked = !unmasked"
              @keydown.enter="passwordConfirmationInput!.focus()"
            />
            <PasswordField
              ref="passwordConfirmationInput"
              v-model="passwordConfirmation"
              id="password_confirmation"
              :label="$t('Confirm new password')"
              :placeholder="$t('Confirm new password')"
              :unmasked="unmasked"
              :invalid="Boolean(validationError)"
              @toggle="unmasked = !unmasked"
              @keydown.enter="setNewPassword"
            />
          </template>

          <p v-else-if="requestSent" role="status" class="af-alert-success flex items-start gap-2.5 rounded-lg border border-green-200 bg-green-50 px-3.5 py-3 text-sm leading-5 text-green-800 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-300">
            <IconCheckCircleOutline class="w-5 h-5 shrink-0" />
            {{ $t('If an account with {email} exists, we sent it a link to reset the password.', { email: sentToEmail }) }}
          </p>

          <div v-else>
            <label for="email" class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">{{ $t('Your email') }}</label>
            <input
              v-model="emailInput"
              id="email"
              name="email"
              type="email"
              autocomplete="email"
              placeholder="name@company.com"
              required
              class="h-11 w-full rounded-lg border-2 border-gray-300 bg-gray-50 px-3.5 text-base text-gray-900 placeholder-gray-400 outline-none focus:border-lightPrimary focus:ring-4 focus:ring-lightPrimary/25 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500 dark:focus:border-darkPrimary dark:focus:ring-darkPrimary/25"
              @keydown.enter="reset()"
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
        </AuthCard>
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
import { IconCheckCircleOutline, IconEnvelopeOutline, IconLockOutline } from '@iconify-prerendered/vue-flowbite';
import { Button, LinkButton } from '@/afcl';
import adminforth from '@/adminforth';
import { getCustomComponent } from '@/utils';
import AuthCard from './AuthCard.vue';
import PasswordField from './PasswordField.vue';

const { t } = useI18n();

const inProgress = ref(false);

const coreStore = useCoreStore();
const requestSent = ref(false);

const emailInput = ref(null);
const passwordConfirmationInput = ref<InstanceType<typeof PasswordField> | null>(null);
const password = ref("");
const passwordConfirmation = ref("");
const unmasked = ref(false);
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

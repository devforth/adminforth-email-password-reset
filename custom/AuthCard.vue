<template>
  <div class="af-auth-card relative flex flex-col w-full max-w-md overflow-hidden rounded-xl border border-lightDialogBreakLine bg-lightDialogBackgorund shadow-2xl dark:border-darkDialogBreakLine dark:bg-darkDialogBackgorund">
    <div class="af-auth-card-header flex items-start gap-3.5 border-b border-lightDialogBreakLine px-6 py-5 dark:border-darkDialogBreakLine">
      <div class="af-auth-card-icon flex w-10 h-10 shrink-0 items-center justify-center rounded-lg bg-lightPrimary/10 text-lightPrimary dark:bg-darkPrimary/20 dark:text-darkPrimary">
        <slot name="icon" />
      </div>
      <div class="af-auth-card-title-wrap flex-1 min-w-0">
        <slot name="title">
          <p class="af-auth-card-title text-lg leading-6 font-semibold text-lightDialogHeaderText dark:text-darkDialogHeaderText">{{ title }}</p>
          <p class="af-auth-card-subtitle mt-0.5 text-sm leading-5 text-gray-500 dark:text-gray-400">{{ subtitle }}</p>
        </slot>
      </div>
    </div>

    <div class="af-auth-card-body flex flex-col gap-4 px-6 pt-5 pb-6">
      <slot />
      <p v-if="error" role="alert" class="af-auth-card-error -mt-1.5 flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400">
        <IconExclamationCircleOutline class="w-4 h-4 shrink-0" />
        {{ error }}
      </p>
    </div>

    <div v-if="$slots.footer" class="af-auth-card-footer flex flex-wrap items-center justify-end gap-x-3 gap-y-2 border-t border-lightDialogBreakLine bg-gray-50 py-3 pl-6 pr-5 dark:border-darkDialogBreakLine dark:bg-gray-800/50">
      <slot name="footer" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { IconExclamationCircleOutline } from '@iconify-prerendered/vue-flowbite';

defineProps<{
  title: string;
  subtitle: string;
  error?: string | null;
}>();
</script>

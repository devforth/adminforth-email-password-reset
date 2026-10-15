<template>
  <div class="af-password-field">
    <label :for="id" class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">{{ label }}</label>
    <div class="relative">
      <input
        ref="input"
        v-model="model"
        :id="id"
        :name="id"
        :type="unmasked ? 'text' : 'password'"
        :placeholder="placeholder"
        autocomplete="new-password"
        required
        class="h-11 w-full rounded-lg border-2 bg-gray-50 pl-3.5 pr-12 text-base text-gray-900 placeholder-gray-400 outline-none focus:ring-4 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
        :class="invalid
          ? 'border-red-500 focus:border-red-500 focus:ring-red-500/25 dark:border-red-400 dark:focus:border-red-400'
          : 'border-gray-300 focus:border-lightPrimary focus:ring-lightPrimary/25 dark:border-gray-600 dark:focus:border-darkPrimary dark:focus:ring-darkPrimary/25'"
      />
      <button
        type="button"
        :aria-label="unmasked ? $t('Hide password') : $t('Show password')"
        class="absolute right-1 top-1 inline-flex w-9 h-9 items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        @click="emit('toggle')"
      >
        <IconEyeOutline v-if="!unmasked" class="w-5 h-5" />
        <IconEyeSlashOutline v-else class="w-5 h-5" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { IconEyeOutline, IconEyeSlashOutline } from '@iconify-prerendered/vue-flowbite';

const model = defineModel<string>({ required: true });

defineProps<{
  id: string;
  label: string;
  placeholder: string;
  unmasked: boolean;
  invalid?: boolean;
}>();

const emit = defineEmits<{
  (e: 'toggle'): void;
}>();

const input = ref<HTMLInputElement | null>(null);

defineExpose({
  focus: () => input.value!.focus(),
});
</script>

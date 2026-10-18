<template>
  <p class="af-reset-password-link text-sm text-left mt-3 text-lightLoginViewSubTextColor dark:text-darkLoginViewSubTextColor">
    {{$t('Forgot password?')}} 
    <Link to="/reset-password">
      {{$t('reset it')}}
    </Link>
  </p>
</template>

<script setup>
import Link from '@/afcl/Link.vue';

</script>
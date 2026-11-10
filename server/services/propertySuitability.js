const isSuitabilityField = field => field.name === 'suitableFor' || (field.kind === 'CUSTOM_FIELD'
  && (['مناسب', 'مناسب برای'].includes(field.label?.fa?.trim())
    || /^(suitable( for)?|avalable)$/i.test(field.label?.en?.trim() || '')));
module.exports = { isSuitabilityField };

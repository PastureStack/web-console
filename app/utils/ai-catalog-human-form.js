import { safeCatalogQuestions } from './ai-catalog-launch';
import { CommandError } from './ai-command-contract';
import { isCatalogQuestionAnswerMissing } from './catalog-question-answer';

const INPUTS = Object.freeze({string: 'schema/input-string', int: 'schema/input-int', float: 'schema/input-float', boolean: 'schema/input-boolean',
  enum: 'schema/input-enum', date: 'schema/input-date', multiline: 'schema/input-multiline', password: 'schema/input-password', masked: 'schema/input-masked',
  service: 'schema/input-service', certificate: 'schema/input-certificate', secret: 'schema/input-secret'});

// Values live only in this form closure. Field.value is non-enumerable; neither
// defaults nor submitted answers become tool refs, pendingPlan or WebStorage.
export function createCatalogHumanForm(input, referenceChoices = {}, noneLabel = '') {
  const questions = safeCatalogQuestions(input), values = new Map();
  const fields = questions.map((question) => {
    const references = (referenceChoices[question.referenceType] || []).map((choice) => ({...choice}));
    const labels = new Map();
    for ( const choice of references ) { labels.set(choice.label, (labels.get(choice.label) || 0) + 1); }
    for ( const choice of references ) { if ( labels.get(choice.label) > 1 ) { choice.disabled = true; } }
    const field = {...question, isReference: question.type === 'reference',
      referencePromptKey: {service: 'schema.inputService.prompt', certificate: 'schema.inputCertificate.prompt', secret: 'schema.inputSecret.prompt'}[question.referenceType],
      hasAmbiguousChoices: references.some((choice) => choice.disabled),
      inputComponent: question.sourceType === 'enum' && !question.options ? INPUTS.string :
        Object.prototype.hasOwnProperty.call(INPUTS, question.sourceType) ? INPUTS[question.sourceType] : INPUTS.string,
      choices: question.type === 'reference' ? [...(!question.required ? [{value: '', label: noneLabel}] : []), ...references] : []};
    Object.defineProperty(field, 'value', {get() { return values.get(question.name); }, set(value) { values.set(question.name, value); }, configurable: true});
    return field;
  });
  return Object.freeze({fields,
    payload() {
      const answers = Object.create(null), referenceBindings = Object.create(null);
      for ( const field of fields ) {
        let value = values.get(field.name);
        if ( value === undefined || value === null ) {
          if ( field.required ) { throw new CommandError('INVALID_INPUT', 'humanInputs'); }
          continue;
        }
        if ( field.required && isCatalogQuestionAnswerMissing(value) ) { throw new CommandError('INVALID_INPUT', 'humanInputs'); }
        if ( field.isReference ) {
          if ( typeof value !== 'string' || !field.choices.some((choice) => choice.value === value && !choice.disabled) ) { throw new CommandError('INVALID_INPUT', 'humanInputs'); }
          referenceBindings[field.name] = value;
          continue;
        }
        if ( ['int', 'float'].includes(field.sourceType) && typeof value === 'string' && /^-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(value) ) { value = Number(value); }
        if ( typeof value === 'string' ? value.length > (field.maxLength === undefined ? 4096 : field.maxLength) || value.includes('\u0000') :
          typeof value !== 'boolean' && (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER) ) { throw new CommandError('INVALID_INPUT', 'humanInputs'); }
        if ( field.sourceType === 'int' && !Number.isSafeInteger(value) || field.sourceType === 'float' && typeof value !== 'number' ) { throw new CommandError('INVALID_INPUT', 'humanInputs'); }
        answers[field.name] = value;
      }
      return {answers, referenceBindings};
    },
    clear() { values.clear(); },
  });
}

import EquipmentEditor from './EquipmentEditor.js'
import PageHeader from '../layout/PageHeader.js'
import { t } from '../../i18n.js'
export default {
  name: 'EquipmentView', components: { EquipmentEditor, PageHeader },
  setup() { return { t } },
  template: `<div class="view equipment-view"><PageHeader :title="t('equipment.title')" /><div class="view__content"><EquipmentEditor /></div></div>`,
}

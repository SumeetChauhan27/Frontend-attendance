import {
  approveTeacherAccount,
  getSystemActivity,
  listTeacherAccounts,
  registerTeacherAccount,
  type SystemActivity,
  type TeacherAccount,
} from '../api'

export const fetchTeacherAccounts = async (): Promise<TeacherAccount[]> =>
  listTeacherAccounts()

export const approveTeacher = async (teacherId: string): Promise<TeacherAccount> =>
  approveTeacherAccount(teacherId)

export const fetchSystemActivity = async (): Promise<SystemActivity> =>
  getSystemActivity()

export const submitTeacherRegistration = async (payload: {
  name: string
  email: string
  password: string
  department: string
}): Promise<TeacherAccount> => registerTeacherAccount(payload)
